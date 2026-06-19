import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import {
  getGameComplaints,
  createComplaint,
  Complaint,
  CreateComplaintDto,
} from "@/api/complaints";
import { useProfileStore } from "@/stores/profileStore";

export const useComplaints = (gameId: string) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { profile } = useProfileStore();

  const fetchComplaints = useCallback(async () => {
    if (!gameId) return;

    setIsLoading(true);
    try {
      const fetchedComplaints = await getGameComplaints(gameId);
      setComplaints(fetchedComplaints);
    } catch (error: any) {
      console.error("Failed to fetch complaints:", error);
      // Don't show alert for fetch errors, just log them
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  const submitComplaint = useCallback(
    async (complaintData: CreateComplaintDto) => {
      if (!gameId) return false;

      setIsSubmitting(true);
      try {
        const newComplaint = await createComplaint(gameId, complaintData);
        setComplaints((prev) => [...prev, newComplaint]);
        Alert.alert(
          "Complaint Submitted",
          "Your complaint has been submitted and is being reviewed. Support will contact you if needed."
        );
        return true;
      } catch (error: any) {
        console.error("Failed to submit complaint:", error);
        Alert.alert(
          "Error",
          error.response?.data?.message ||
            "Failed to submit complaint. Please try again."
        );
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [gameId]
  );

  // Get the current user's complaint for this game
  const currentUserComplaint = complaints.find(
    (complaint) => complaint.complainant_id === profile?.id
  );

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  return {
    complaints,
    currentUserComplaint,
    isLoading,
    isSubmitting,
    submitComplaint,
    refetch: fetchComplaints,
  };
};
