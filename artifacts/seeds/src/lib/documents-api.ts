export const DOC_TYPES = [
  "general",
  "meeting_note",
  "event_checklist",
  "recruitment_checklist",
  "finance",
  "onboarding",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  general: "일반",
  meeting_note: "회의록",
  event_checklist: "행사 체크리스트",
  recruitment_checklist: "모집 체크리스트",
  finance: "재무",
  onboarding: "온보딩",
  other: "기타",
};

export const DOC_VISIBILITIES = ["admin_only", "mentor_visible"] as const;
export type DocVisibility = (typeof DOC_VISIBILITIES)[number];

export const DOC_VISIBILITY_LABEL: Record<DocVisibility, string> = {
  admin_only: "운영진만",
  mentor_visible: "운영진+멘토",
};

export type DocumentItem = {
  id: number;
  title: string;
  contentMd: string;
  docType: DocType;
  isTemplate: boolean;
  visibility: DocVisibility;
  linkedObjectType: string | null;
  linkedObjectId: number | null;
  archivedAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentVersionSummary = {
  id: number;
  documentId: number;
  versionNo: number;
  title: string;
  editedBy: number | null;
  editorName: string | null;
  editorEmail: string | null;
  createdAt: string;
};

export type DocumentDetail = DocumentItem & {
  versions: DocumentVersionSummary[];
};

export type DocumentVersionDetail = {
  id: number;
  documentId: number;
  versionNo: number;
  title: string;
  contentMd: string;
  editedBy: number | null;
  createdAt: string;
};
