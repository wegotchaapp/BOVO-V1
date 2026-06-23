import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.userRole = payload.role;

      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Clean up if needed
  }

  @SubscribeMessage('join:conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('leave:conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.leave(`conversation:${conversationId}`);
  }

  @SubscribeMessage('join:trip')
  handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() bookingId: string,
  ) {
    client.join(`trip:${bookingId}`);
  }

  @SubscribeMessage('join:safety')
  handleJoinSafety(
    @ConnectedSocket() client: Socket,
    @MessageBody() bookingId: string,
  ) {
    client.join(`safety:${bookingId}`);
  }

  emitNewMessage(conversationId: string, message: any) {
    this.server.to(`conversation:${conversationId}`).emit(
      `message:new:${conversationId}`,
      message,
    );
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);
  }

  emitMessageUpdated(conversationId: string, message: any) {
    this.server.to(`conversation:${conversationId}`).emit(
      `message:updated:${conversationId}`,
      message,
    );
  }

  emitConversationUpdated(userId: string) {
    this.server.to(`user:${userId}`).emit('conversation:updated');
  }

  emitTripPing(bookingId: string, ping: any) {
    this.server.to(`trip:${bookingId}`).emit('trip:ping', ping);
  }

  emitSosEvent(bookingId: string, sos: any) {
    this.server.to(`safety:${bookingId}`).emit('sos:event', sos);
  }

  emitDeviation(bookingId: string, deviation: any) {
    this.server.to(`safety:${bookingId}`).emit('deviation:event', deviation);
  }

  emitBookingUpdated(bookingId: string, booking: any) {
    this.server.to(`trip:${bookingId}`).emit('booking:updated', booking);
  }
}
