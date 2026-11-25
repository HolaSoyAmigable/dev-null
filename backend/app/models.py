"""Registry that imports every model so Alembic sees the full metadata."""

from app.core.models import Base
from app.modules.auth.models import User
from app.modules.career.models import CareerEntry
from app.modules.media.models import Media
from app.modules.metrics.models import DailyStat, EngagementEvent, PageView
from app.modules.posts.models import Post, PostRevision, post_tags
from app.modules.projects.models import Project
from app.modules.revalidation.models import WebhookLog
from app.modules.settings.models import SiteSetting
from app.modules.taxonomy.models import Category, Tag

__all__ = [
    "Base",
    "CareerEntry",
    "Category",
    "DailyStat",
    "EngagementEvent",
    "Media",
    "PageView",
    "Post",
    "PostRevision",
    "Project",
    "SiteSetting",
    "Tag",
    "User",
    "WebhookLog",
    "post_tags",
]
