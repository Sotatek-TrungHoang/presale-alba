import axios from "axios";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import { auth } from "@/firebase.config";
import { getIdToken } from "firebase/auth";

export type ReportTargetType = "USER" | "CONVERSATION" | "GAME";

export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "INAPPROPRIATE"
  | "SCAM"
  | "OTHER";

export interface CreateReportDto {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

const getFirebaseAuthToken = async (forceRefresh: boolean = false) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Authentication required.");
  return getIdToken(currentUser, forceRefresh);
};

const apiClient = axios.create(DEFAULT_CONFIG);

apiClient.interceptors.request.use(async (config) => {
  const token = await getFirebaseAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const createReport = async (dto: CreateReportDto) => {
  const res = await apiClient.post(buildApiUrl("reports"), dto);
  return res.data;
};
