import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { FirebaseService } from '../firebase/firebase.service';

interface ExtendedSocket extends Socket {
  userId?: string;
  userAuthId?: string; // Firebase UID
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms = new Map<string, Set<string>>(); // clientId -> Set of roomIds

  constructor(
    private chatService: ChatService,
    private firebaseService: FirebaseService,
  ) {}

  handleConnection(client: ExtendedSocket) {
    console.log(`Client connected: ${client.id}`);
    this.rooms.set(client.id, new Set());
  }

  handleDisconnect(client: ExtendedSocket) {
    console.log(`Client disconnected: ${client.id}`);

    // Remove user activity tracking when they disconnect
    this.chatService.removeUserActivity(client.id);
    this.rooms.delete(client.id);
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    try {
      console.log('[ChatGateway] Authenticating with Firebase token');

      // Verify Firebase token
      const decodedToken = await this.firebaseService
        .getAuth()
        .verifyIdToken(data.token);

      // Look up user in database using Firebase UID
      const user = await this.chatService.getUserByAuthId(decodedToken.uid);

      if (!user) {
        console.error('[ChatGateway] User not found in database');
        client.emit('authError', { message: 'User not found' });
        return { status: 'error', message: 'User not found' };
      }

      // Store both Firebase UID and internal user ID
      client.userAuthId = decodedToken.uid;
      client.userId = user.id;

      console.log(
        `Client ${client.id} authenticated as user ${user.id} (Firebase: ${decodedToken.uid})`,
      );
      return { status: 'authenticated', userId: user.id };
    } catch (error) {
      console.error('[ChatGateway] Authentication failed:', error);
      client.emit('authError', { message: 'Invalid token' });
      return { status: 'error', message: 'Invalid token' };
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    const { roomId } = data;
    const clientRooms = this.rooms.get(client.id);
    if (!clientRooms) return { error: 'Not connected' };

    if (clientRooms.has(roomId)) {
      return { status: 'already-joined' };
    }

    await client.join(roomId);
    clientRooms.add(roomId);

    // Track user activity for smart notifications
    if (client.userId) {
      this.chatService.trackUserActivity(client.id, client.userId, roomId);
    }

    return { status: 'success' };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    const { roomId } = data;
    const clientRooms = this.rooms.get(client.id);
    if (!clientRooms?.has(roomId)) {
      return { status: 'not-in-room' };
    }

    client.leave(roomId);
    clientRooms.delete(roomId);

    // Remove activity tracking when leaving room
    this.chatService.removeUserActivity(client.id);

    return { status: 'success' };
  }

  @SubscribeMessage('markActivity')
  handleMarkActivity(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    // Update user activity timestamp for smart notifications
    if (client.userId) {
      this.chatService.trackUserActivity(
        client.id,
        client.userId,
        data.conversationId,
      );
    }
    return { status: 'updated' };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() messageData: { content: string; conversation_id: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    try {
      console.log('[ChatGateway] Received sendMessage:', messageData);

      // Check if user is authenticated
      if (!client.userId) {
        console.error('[ChatGateway] User not authenticated');
        client.emit('error', { message: 'User not authenticated' });
        return { error: 'User not authenticated' };
      }

      const clientRooms = this.rooms.get(client.id);
      if (!clientRooms?.has(messageData.conversation_id)) {
        console.error('[ChatGateway] User not in room');
        client.emit('error', { message: 'Not in room' });
        return { error: 'Not in room' };
      }

      // Create the full message DTO with authenticated user_id
      const createMessageDto: CreateMessageDto = {
        content: messageData.content,
        conversation_id: messageData.conversation_id,
        user_id: client.userId, // Auto-populate from authenticated session
      };

      console.log('[ChatGateway] Creating message with DTO:', createMessageDto);

      // Update activity tracking since user just sent a message
      this.chatService.trackUserActivity(
        client.id,
        client.userId,
        messageData.conversation_id,
      );

      const message = await this.chatService.createMessage(createMessageDto);

      console.log('[ChatGateway] Message created, broadcasting...');

      this.server.to(messageData.conversation_id).emit('newMessage', message);

      // Acknowledge to sender
      client.emit('messageAck', message);

      return { success: true, message };
    } catch (error) {
      console.error('[ChatGateway] Error in sendMessage:', error);
      client.emit('error', {
        message: 'Failed to send message',
        error: error.message,
      });
      return { error: 'Failed to send message' };
    }
  }
}
