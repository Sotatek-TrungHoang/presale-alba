import { useEffect, useState, useRef, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { ChatMessage } from "@/api/chat";
import { Alert } from "react-native";
import { auth } from "@/firebase.config";
import { getIdToken } from "firebase/auth";

// Updated payload - backend now auto-populates user_id from authenticated session
interface CreateMessagePayload {
  content: string;
  conversation_id: string;
  // user_id removed - backend gets this from authenticated session
}

interface UseChatSocketProps {
  conversationId: string | undefined;
  onNewMessage: (message: ChatMessage) => void;
  onMessageAck?: (message: ChatMessage) => void;
  onJoinRoomSuccess?: () => void;
  onJoinRoomError?: (error: any) => void;
}

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL;

export const useChatSocket = ({
  conversationId,
  onNewMessage,
  onMessageAck,
  onJoinRoomSuccess,
  onJoinRoomError,
}: UseChatSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Get Firebase auth token
  const getFirebaseToken = async (): Promise<string | null> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error("No authenticated user found");
        return null;
      }
      const token = await getIdToken(currentUser);
      return token;
    } catch (error) {
      console.error("Failed to get Firebase token:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!conversationId) {
      console.log("useChatSocket: No conversationId, not connecting.");
      return;
    }

    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error("No authenticated user, cannot connect to chat");
      return;
    }

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    const socket = socketRef.current;

    socket.on("connect", async () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);

      // Authenticate with Firebase token
      const firebaseToken = await getFirebaseToken();
      if (!firebaseToken) {
        console.error("Failed to get Firebase token");
        Alert.alert(
          "Authentication Error",
          "Failed to authenticate with chat server"
        );
        return;
      }

      console.log("Authenticating with Firebase token...");
      socket.emit(
        "authenticate",
        { token: firebaseToken },
        (authResponse: any) => {
          console.log("Authentication response:", authResponse);

          if (authResponse?.status === "authenticated") {
            console.log("Successfully authenticated");
            setIsAuthenticated(true);

            // Now join the room with updated payload format
            socket.emit(
              "joinRoom",
              { roomId: conversationId },
              (ack: { status: string; error?: any }) => {
                if (ack && ack.status === "success") {
                  console.log(`Successfully joined room: ${conversationId}`);
                  if (onJoinRoomSuccess) onJoinRoomSuccess();
                } else {
                  console.error(
                    `Failed to join room ${conversationId}:`,
                    ack?.error || ack
                  );
                  if (onJoinRoomError)
                    onJoinRoomError(ack?.error || "Failed to join room");
                  Alert.alert(
                    "Chat Error",
                    `Could not join chat room. ${ack?.error || ""}`
                  );
                }
              }
            );
          } else {
            console.error("Authentication failed:", authResponse);
            setIsAuthenticated(false);
            Alert.alert(
              "Authentication Error",
              "Failed to authenticate with chat server"
            );
          }
        }
      );
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
      setIsAuthenticated(false);
      Alert.alert(
        "Connection Error",
        "Could not connect to chat. Please check your internet connection and try again."
      );
    });

    // Handle authentication errors from backend
    socket.on("authError", (error) => {
      console.error("Authentication error:", error);
      setIsAuthenticated(false);
      Alert.alert(
        "Authentication Error",
        error.message || "Authentication failed"
      );
    });

    // Handle general errors from backend
    socket.on("error", (error) => {
      console.error("Socket error:", error);
      Alert.alert("Chat Error", error.message || "An error occurred");
    });

    socket.on("newMessage", (message: ChatMessage) => {
      console.log("Received new message:", message);
      onNewMessage(message);
    });

    if (onMessageAck) {
      socket.on("messageAck", (message: ChatMessage) => {
        onMessageAck(message);
      });
    }

    return () => {
      if (socket) {
        console.log(
          "Cleaning up socket connection for conversation:",
          conversationId
        );
        if (isAuthenticated) {
          // Updated leaveRoom call with object payload
          socket.emit("leaveRoom", { roomId: conversationId }, (ack: any) => {
            console.log("Leave room ack:", ack);
          });
        }
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.off("authError");
        socket.off("error");
        socket.off("newMessage");
        if (onMessageAck) socket.off("messageAck");
        socket.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setIsAuthenticated(false);
      }
    };
  }, [
    conversationId,
    onNewMessage,
    onMessageAck,
    onJoinRoomSuccess,
    onJoinRoomError,
  ]);

  const sendMessage = useCallback(
    (payload: CreateMessagePayload) => {
      if (
        socketRef.current &&
        socketRef.current.connected &&
        conversationId &&
        isAuthenticated
      ) {
        console.log("Emitting sendMessage:", payload);
        socketRef.current.emit("sendMessage", payload);
      } else {
        console.error(
          "Socket not connected, not authenticated, or no conversationId, cannot send message.",
          {
            connected: socketRef.current?.connected,
            conversationId,
            isAuthenticated,
          }
        );
        Alert.alert(
          "Chat Error",
          "Not connected to chat. Cannot send message."
        );
      }
    },
    [conversationId, isAuthenticated]
  );

  // Mark user activity in conversation (useful for notification management)
  const markActivity = useCallback(() => {
    if (
      socketRef.current &&
      socketRef.current.connected &&
      conversationId &&
      isAuthenticated
    ) {
      socketRef.current.emit("markActivity", { conversationId });
    }
  }, [conversationId, isAuthenticated]);

  return {
    socket: socketRef.current,
    isConnected,
    isAuthenticated,
    sendMessage,
    markActivity,
  };
};
