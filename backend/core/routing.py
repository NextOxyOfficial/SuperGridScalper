from django.urls import re_path
from . import consumers
from . import fm_consumers

websocket_urlpatterns = [
    re_path(r'^ws/trade/(?P<license_key>[^/]+)/$', consumers.TradeConsumer.as_asgi()),
    re_path(r'^ws/trades/all/(?P<email>[^/]+)/$', consumers.AllTradesConsumer.as_asgi()),
    re_path(r'^ws/fm-chat/(?P<fm_id>[^/]+)/(?P<email>[^/]+)/$', fm_consumers.FMChatConsumer.as_asgi()),
]
