import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class TradeConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for single license trade data updates."""

    async def connect(self):
        self.license_key = self.scope['url_route']['kwargs']['license_key']
        self.group_name = f'trade_{self.license_key}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def trade_update(self, event):
        await self.send(text_data=json.dumps(event['data']))


class AllTradesConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for all-licenses trade data overview by user email."""

    async def connect(self):
        self.email = self.scope['url_route']['kwargs']['email']
        self.group_name = f'trades_all_{self.email.replace("@", "_at_").replace(".", "_")}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def trade_update(self, event):
        await self.send(text_data=json.dumps(event['data']))
