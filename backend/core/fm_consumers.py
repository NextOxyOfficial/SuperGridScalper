import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class FMChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for Fund Manager group chat"""

    async def connect(self):
        self.fm_id = self.scope['url_route']['kwargs'].get('fm_id', '')
        self.email = self.scope['url_route']['kwargs'].get('email', '')
        
        if not self.fm_id or not self.email:
            await self.close()
            return

        self.room_group_name = f'fm_chat_{self.fm_id}'

        # Verify access
        has_access = await self._check_access()
        if not has_access:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Send system message that user joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'data': {
                    'email': self.email,
                    'message': f'{self.email} joined the chat',
                }
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            msg_type = data.get('type', 'message')
            
            if msg_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                return
            
            if msg_type == 'typing':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_typing',
                        'data': {
                            'email': self.email,
                            'is_typing': data.get('is_typing', True),
                        }
                    }
                )
                return

        except json.JSONDecodeError:
            pass

    async def chat_message(self, event):
        """Broadcast new chat message to all connected clients"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'data': event['data'],
        }))

    async def user_joined(self, event):
        """Broadcast user joined notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'data': event['data'],
        }))

    async def user_typing(self, event):
        """Broadcast typing indicator"""
        if event['data']['email'] != self.email:
            await self.send(text_data=json.dumps({
                'type': 'user_typing',
                'data': event['data'],
            }))

    async def fm_command(self, event):
        """Broadcast FM command (EA on/off) notification"""
        await self.send(text_data=json.dumps({
            'type': 'fm_command',
            'data': event['data'],
        }))

    async def announcement(self, event):
        """Broadcast announcement from FM"""
        await self.send(text_data=json.dumps({
            'type': 'announcement',
            'data': event['data'],
        }))

    @database_sync_to_async
    def _check_access(self):
        """Check if user has access to this FM chat"""
        from core.models import FundManager, FMSubscription
        from django.contrib.auth.models import User
        
        try:
            fm = FundManager.objects.get(id=self.fm_id, status='approved')
        except FundManager.DoesNotExist:
            return False
        
        user = User.objects.filter(email__iexact=self.email).first()
        if not user:
            return False
        
        # FM always has access
        if fm.user == user:
            return True
        
        # Active subscribers have access
        return FMSubscription.objects.filter(
            user=user,
            fund_manager=fm,
            status__in=['active', 'trial']
        ).exists()
