from datetime import date

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class BaselineConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    annual_rate: float = Field(ge=0, le=1)
    source_name: str = Field(min_length=1)
    source_url: HttpUrl
    checked_at: date
