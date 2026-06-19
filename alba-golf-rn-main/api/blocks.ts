import axios from "axios";
import { buildApiUrl, DEFAULT_CONFIG } from "./config";
import { auth } from "@/firebase.config";
import { getIdToken } from "firebase/auth";

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

type BlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export const blockUser = async (userId: string) => {
  if (!userId) throw new Error("userId is required");
  const res = await apiClient.post(buildApiUrl("blocks"), { userId });
  return res.data;
};

export const unblockUser = async (userId: string) => {
  if (!userId) throw new Error("userId is required");
  const res = await apiClient.delete(buildApiUrl(`blocks/${userId}`));
  return res.data;
};

export const getBlockedUsers = async (): Promise<BlockRow[]> => {
  const res = await apiClient.get(buildApiUrl("blocks"));
  return res.data as BlockRow[];
};

export const isUserBlocked = async (userId: string) => {
  const rows = await getBlockedUsers();
  return rows.some((r) => r.blocked_id === userId);
};
