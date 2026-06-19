import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Pressable,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/constants/theme";
import { ChatMessage } from "@/api/chat";
import { getConversationMessages } from "@/api/conversations";
import { useProfileStore } from "@/stores/profileStore";
import { Ionicons } from "@expo/vector-icons";
import { useChatSocket } from "@/hooks/useChatSocket";
import { createReport } from "@/api/reports";
import { filterContent, shouldFlagForReview, getViolationMessage } from "@/utils/contentFilter";

// For DTO when sending message via WebSocket (matches backend CreateMessageDto)
interface CreateMessagePayload {
  content: string;
  conversation_id: string;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { profile } = useProfileStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const handleNewMessage = useCallback((newMessage: ChatMessage) => {
    setMessages((prevMessages) => [newMessage, ...prevMessages]);
  }, []);

  const handleMessageAck = useCallback((ackedMessage: ChatMessage) => {
    console.log("Message acknowledged by server:", ackedMessage.id);
  }, []);

  const handleJoinRoomSuccess = useCallback(() => {
    console.log("Chat room joined successfully!");
  }, []);

  const handleJoinRoomError = useCallback((joinError: any) => {
    Alert.alert("Chat Join Error", `Could not join chat: ${joinError}`);
  }, []);

  const { isConnected, isAuthenticated, sendMessage, markActivity } =
    useChatSocket({
      conversationId,
      onNewMessage: handleNewMessage,
      onMessageAck: handleMessageAck,
      onJoinRoomSuccess: handleJoinRoomSuccess,
      onJoinRoomError: handleJoinRoomError,
    });

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setError("Conversation ID not found.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedMessages = await getConversationMessages(conversationId);
      setMessages(fetchedMessages.slice().reverse());
    } catch (err: any) {
      console.error("Failed to fetch messages:", err);
      setError("Failed to load messages. " + (err.message || ""));
      Alert.alert("Error", "Could not load messages. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const handleSend = () => {
    if (!inputText.trim() || !profile?.id || !conversationId) {
      Alert.alert(
        "Error",
        "Cannot send empty message or missing user/conversation ID."
      );
      return;
    }
    if (!isConnected) {
      Alert.alert(
        "Not Connected",
        "You are not connected to the chat server. Please wait or try again."
      );
      return;
    }

    // Filter content before sending
    const filterResult = filterContent(inputText.trim());
    
    if (!filterResult.isAllowed) {
      Alert.alert(
        "Message Blocked",
        getViolationMessage(filterResult.violations),
        [
          {
            text: "Edit Message",
            style: "default",
          },
          {
            text: "OK",
            style: "cancel",
          },
        ]
      );
      return;
    }

    // If content should be flagged for review, show warning but allow
    if (shouldFlagForReview(filterResult)) {
      Alert.alert(
        "Message Flagged",
        "Your message has been flagged for review. It will be sent but may be removed if it violates our community guidelines.",
        [
          {
            text: "Send Anyway",
            onPress: () => {
              const payload: CreateMessagePayload = {
                content: filterResult.filteredContent,
                conversation_id: conversationId,
              };
              sendMessage(payload);
              setInputText("");
            },
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
      return;
    }

    const payload: CreateMessagePayload = {
      content: filterResult.filteredContent,
      conversation_id: conversationId,
    };

    sendMessage(payload);
    setInputText("");
  };

  const handleReportMessage = async (message: ChatMessage) => {
    Alert.alert(
      "Report Message",
      "Why are you reporting this message?",
      [
        {
          text: "Spam",
          onPress: async () => {
            try {
              await createReport({
                targetType: "CONVERSATION",
                targetId: conversationId!,
                reason: "SPAM",
                description: `Reported message: "${message.content.substring(0, 100)}..."`,
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        {
          text: "Harassment",
          onPress: async () => {
            try {
              await createReport({
                targetType: "CONVERSATION",
                targetId: conversationId!,
                reason: "HARASSMENT",
                description: `Reported message: "${message.content.substring(0, 100)}..."`,
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        {
          text: "Inappropriate",
          onPress: async () => {
            try {
              await createReport({
                targetType: "CONVERSATION",
                targetId: conversationId!,
                reason: "INAPPROPRIATE",
                description: `Reported message: "${message.content.substring(0, 100)}..."`,
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        {
          text: "Other",
          onPress: async () => {
            try {
              await createReport({
                targetType: "CONVERSATION",
                targetId: conversationId!,
                reason: "OTHER",
                description: `Reported message: "${message.content.substring(0, 100)}..."`,
              });
              Alert.alert("Thanks", "Your report has been submitted.");
            } catch {
              Alert.alert("Error", "Could not submit report. Try again.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.user_id === profile?.id;
    return (
      <View
        style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
        ]}
      >
        {!isMyMessage && (
          <View style={styles.messageHeader}>
            <Text style={styles.messageSenderName}>
              {item.user?.profile?.first_name || "User"}
            </Text>
            <TouchableOpacity
              onPress={() => handleReportMessage(item)}
              style={styles.reportButton}
            >
              <Ionicons name="flag-outline" size={16} color={colors.text.disabled} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.messageText}>{item.content}</Text>
        <Text style={styles.messageTimestamp}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="small" color={colors.primary.orange} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Stack.Screen options={{ title: "Chat Error" }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchMessages} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const getConnectionStatus = () => {
    if (!isConnected) return "(Connecting...)";
    if (!isAuthenticated) return "(Authenticating...)";
    return "";
  };

  const getPlaceholderText = () => {
    if (!isConnected) return "Connecting to chat...";
    if (!isAuthenticated) return "Authenticating...";
    return "Type a message...";
  };

  const isChatReady = isConnected && isAuthenticated;

  const promptReportConversation = () => {
    if (!conversationId) {
      Alert.alert("Error", "Conversation ID missing.");
      return;
    }
    Alert.alert("Report Conversation", "Tell us what’s wrong:", [
      {
        text: "Spam",
        onPress: async () => {
          try {
            await createReport({
              targetType: "CONVERSATION",
              targetId: conversationId,
              reason: "SPAM",
            });
            Alert.alert("Thanks", "Your report has been submitted.");
          } catch {
            Alert.alert("Error", "Could not submit report. Try again.");
          }
        },
      },
      {
        text: "Harassment",
        onPress: async () => {
          try {
            await createReport({
              targetType: "CONVERSATION",
              targetId: conversationId,
              reason: "HARASSMENT",
            });
            Alert.alert("Thanks", "Your report has been submitted.");
          } catch {
            Alert.alert("Error", "Could not submit report. Try again.");
          }
        },
      },
      {
        text: "Inappropriate",
        onPress: async () => {
          try {
            await createReport({
              targetType: "CONVERSATION",
              targetId: conversationId,
              reason: "INAPPROPRIATE",
            });
            Alert.alert("Thanks", "Your report has been submitted.");
          } catch {
            Alert.alert("Error", "Could not submit report. Try again.");
          }
        },
      },
      {
        text: "Scam",
        onPress: async () => {
          try {
            await createReport({
              targetType: "CONVERSATION",
              targetId: conversationId,
              reason: "SCAM",
            });
            Alert.alert("Thanks", "Your report has been submitted.");
          } catch {
            Alert.alert("Error", "Could not submit report. Try again.");
          }
        },
      },
      {
        text: "Other",
        onPress: async () => {
          try {
            await createReport({
              targetType: "CONVERSATION",
              targetId: conversationId,
              reason: "OTHER",
            });
            Alert.alert("Thanks", "Your report has been submitted.");
          } catch {
            Alert.alert("Error", "Could not submit report. Try again.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleHeaderMenuPress = () => {
    Alert.alert("Options", undefined, [
      { text: "Report Conversation", onPress: promptReportConversation },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: `Chat ${getConnectionStatus()}`,
          headerRight: () => (
            <Pressable onPress={handleHeaderMenuPress} style={{ padding: 8 }}>
              <Ionicons
                name="ellipsis-horizontal"
                size={24}
                color={colors.text.primary}
              />
            </Pressable>
          ),
        }}
      />
      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.flexContainer}
          keyboardVerticalOffset={75}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            inverted
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={getPlaceholderText()}
              placeholderTextColor={colors.text.disabled}
              multiline
              editable={isChatReady}
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[
                styles.sendButton,
                !isChatReady && styles.sendButtonDisabled,
              ]}
              disabled={!isChatReady}
            >
              <Ionicons
                name="send"
                size={24}
                color={
                  isChatReady ? colors.primary.orange : colors.text.disabled
                }
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flexContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.messageList}
            contentContainerStyle={[
              styles.messageListContent,
              keyboardVisible && { paddingBottom: 300 },
            ]}
            inverted
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={getPlaceholderText()}
              placeholderTextColor={colors.text.disabled}
              multiline
              editable={isChatReady}
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[
                styles.sendButton,
                !isChatReady && styles.sendButtonDisabled,
              ]}
              disabled={!isChatReady}
            >
              <Ionicons
                name="send"
                size={24}
                color={
                  isChatReady ? colors.primary.orange : colors.text.disabled
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  flexContainer: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral.black,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: typography.fontSizes.md,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary.orange,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
  },
  retryButtonText: {
    color: colors.neutral.white,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSizes.md,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  messageListContent: {
    paddingVertical: spacing.md,
  },
  messageBubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    marginBottom: spacing.sm,
    maxWidth: "80%",
  },
  myMessageBubble: {
    backgroundColor: colors.neutral.black,
    borderWidth: 1,
    borderColor: colors.neutral.surface,
    alignSelf: "flex-end",
    borderBottomRightRadius: spacing.xs,
  },
  otherMessageBubble: {
    backgroundColor: colors.neutral.surface,
    alignSelf: "flex-start",
    borderBottomLeftRadius: spacing.xs,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  messageSenderName: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.medium,
    flex: 1,
  },
  reportButton: {
    padding: spacing.xs,
  },
  messageText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
  messageTimestamp: {
    color: colors.text.disabled,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    alignSelf: "flex-end",
    marginTop: spacing.xxs,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surface,
    backgroundColor: colors.neutral.black,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "ios" ? spacing.sm : spacing.xs,
    paddingBottom: Platform.OS === "ios" ? spacing.sm : spacing.xs,
    fontSize: typography.fontSizes.md,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  sendButton: {
    padding: spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
