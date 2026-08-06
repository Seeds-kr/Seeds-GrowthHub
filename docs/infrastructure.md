# 프리뷰 인프라 — seeds.harvester.kr

이 문서는 **프리뷰 환경**을 다룬다. 프로덕션이 아니고, 데이터도 손으로 심은 것이 섞여 있다.
다만 "재부팅하면 사라지는" 상태는 벗어났다.

```
인터넷 ── Cloudflare 터널 ──> router(127.0.0.1:8088) ──/api──> api-server(127.0.0.1:8087)
                                          └──────────────────> seeds/dist/public (SPA)
                                                                        │
                                                    seeds_growthhub_pg (127.0.0.1:5434)
```

전부 `127.0.0.1` 에만 바인딩한다. 이 머신은 공인 IP 가 NIC 직결이라 `0.0.0.0` 은 곧 인터넷
공개이고, 그러면 Cloudflare 를 우회해 API·DB 를 직접 때릴 수 있다.

## systemd 유닛

| 유닛 | 하는 일 |
|---|---|
| `seeds-db.service` | Postgres 컨테이너를 올린다 (`oneshot` + `RemainAfterExit`) |
| `seeds-api.service` | api-server. DB 준비 전이면 죽고 `Restart=always` 로 다시 붙는다 |
| `seeds-router.service` | 정적 파일 + `/api` 프록시 |
| `seeds-tunnel.service` | cloudflared |
| `seeds-backup.timer` | 매일 04:30 DB 덤프 (`Persistent=true` 라 꺼져 있던 동안 것도 따라잡는다) |

```bash
sudo systemctl status seeds-db seeds-api seeds-router seeds-tunnel
journalctl -u seeds-api -n 50
```

### 왜 도커 restart 정책만으로 부족한가

컨테이너에 `--restart always` 를 걸어 뒀지만, `docker stop` 이나 `docker kill` 을 한 번
거치면 도커가 그 컨테이너를 "수동 정지" 로 표시하고 정책을 적용하지 않는다. 실제로
`docker kill` 후 `restartCount=0` 으로 죽어 있는 걸 확인했다. 그 상태로 재부팅하면 DB 만
안 올라온다. `seeds-db.service` 가 부팅 때 한 번 더 `docker start` 를 해서 이 구멍을 막는다.

> 실제 재부팅으로는 검증하지 않았다. 도커 데몬을 재시작하면 이 머신의 다른 프로젝트
> 컨테이너(lala_postgres 등)가 함께 내려가기 때문이다. 대신 컨테이너를 정지시킨 뒤
> `systemctl restart seeds-db` 로 다시 올라오는 것까지 확인했다.

## 데이터

- 볼륨: `seeds_growthhub_pgdata` (명명 볼륨)
  - 원래는 이름 없는 볼륨이었다. `docker volume prune` 한 번에 사라지는 자리이고,
    무엇이 들어 있는지 아무도 알 수 없다. 백업으로 복원을 검증한 뒤 옮겼다.
- 백업: `/home/harvester/seeds-preview/backups/growthhub-<날짜>.sql.gz` (600, 30일 보관)
  - `backup.sh` 는 `.part` 로 받아 gzip 무결성과 최소 크기를 확인한 뒤에만 정식 이름을 준다.
    끊긴 덤프가 "성공한 백업" 으로 남지 않게 하려는 것이다.
  - 보관 기간이 지나도 최소 3개는 남긴다.

```bash
# 수동 백업
/home/harvester/seeds-preview/backup.sh

# 복원 (반드시 사본에 먼저 해 보고 옮길 것)
zcat backups/growthhub-<날짜>.sql.gz | docker exec -i seeds_growthhub_pg psql -U growthhub -d growthhub
```

### 옛 컨테이너를 남겨 둔 이유

`growthhub_pg_OLD_20260804` (정지 상태)가 이름 없는 옛 볼륨을 붙들고 있다. 새 볼륨이
멀쩡한 걸 며칠 지켜본 뒤 지우면 된다. 지울 때는 볼륨까지 같이 지워야 디스크가 돈다:

```bash
docker rm -v growthhub_pg_OLD_20260804
```

## 스키마 마이그레이션

`db push` 만 쓰면 어떤 SQL 이 나갔는지 아무 데도 안 남아서, 다른 환경에 같은 상태를 다시
만들 수 없고 무엇이 언제 바뀌었는지 되짚을 수도 없다. 마이그레이션 파일을 남긴다.

```bash
cd lib/db
pnpm run generate   # 스키마 수정 후. drizzle/NNNN_*.sql 이 생긴다 - 읽고 커밋한다
pnpm run migrate    # 반영
pnpm run check      # 마이그레이션끼리 충돌하는지
```

현재 DB 는 `push` 로 만들어져 이력이 없었으므로 `0000` 을 "적용됨" 으로 기록해 베이스라인을
잡았다(`drizzle.__drizzle_migrations`). 사본에 먼저 적용해 `migrate` 가 아무것도 건드리지
않고 데이터도 그대로인 것을 확인한 뒤 실제 DB 에 넣었다.

## 지금 DB 에 든 것

프리뷰 DB 에는 **실제 자료와 테스트 픽스처가 섞여 있다.**

| | |
|---|---|
| 실제 | 멘토 프로필 9명(공개 사이트가 쓴다), 운영 계정 `admin@seeds.local` |
| 픽스처 | 계정 11개(`smoke-*` `legacy-*` `*-z@` 등), 주행이 만든 지원서·공지·과제·회고·상태체크 |

유저 스토리(`e2e/stories.mjs`)는 돌릴 때마다 자료를 새로 만든다. 그냥 두면 계속 쌓인다.

**실제 기수를 받기 시작하기 전에** 한 번 정리한다:

```bash
ops/reset-test-data.sh     # 무엇이 지워지는지 보여주고 확인을 받은 뒤, 백업하고 지운다
```

사본에 먼저 적용해 검증했다 — 계정 12개 → `admin@seeds.local` 하나, 멘토 프로필 9명과
기수는 그대로 남는다. 지금 프리뷰에는 **일부러 돌리지 않았다**: 테스트 계정을 지우면
유저 스토리의 멘토·학생·평가위원 축이 통째로 BLOCK 이 된다.

## 아직 안 된 것

- **실제 재부팅 검증** (위 사유)
- **백업의 외부 보관** — 지금은 같은 NVMe 한 장에만 있다. 디스크가 죽으면 백업도 같이 죽는다.
  판단해서 미룬 것이다: 지금 데이터는 대부분 테스트용이고, 실제 학생 지원서를 받기
  시작하면 그때가 필요한 시점이다. 그전에 다시 잡는다.
