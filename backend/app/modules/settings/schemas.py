"""Site settings schemas."""

from pydantic import BaseModel, Field, HttpUrl


class SocialLink(BaseModel):
    label: str = Field(min_length=1, max_length=50)
    url: HttpUrl


class SiteSettings(BaseModel):
    """Every configurable setting with its expected type."""

    site_name: str = Field(default="dev/null", min_length=1, max_length=100)
    author_name: str = Field(default="[TU NOMBRE]", min_length=1, max_length=150)
    short_bio: str = Field(default="", max_length=500)
    social_links: list[SocialLink] = Field(default_factory=list)
    about_md: str = ""


class SiteSettingsUpdate(BaseModel):
    site_name: str | None = Field(default=None, min_length=1, max_length=100)
    author_name: str | None = Field(default=None, min_length=1, max_length=150)
    short_bio: str | None = Field(default=None, max_length=500)
    social_links: list[SocialLink] | None = None
    about_md: str | None = None
