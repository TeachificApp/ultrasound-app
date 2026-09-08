const SMTPCOM_CHANNELS_URL = "https://api.smtp.com/v4/channels/";

export type SmtpComChannelSummary = {
  name: string;
  label?: string;
};

/** List SMTP.com channels for the configured API key (helps pick SMTPCOM_CHANNEL). */
export async function listSmtpComChannels(): Promise<{
  ok: boolean;
  channels: SmtpComChannelSummary[];
  error?: string;
}> {
  const apiKey = process.env.SMTPCOM_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, channels: [], error: "SMTPCOM_API_KEY not set" };
  }

  try {
    const res = await fetch(SMTPCOM_CHANNELS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, channels: [], error: `SMTP.com channels API ${res.status}: ${text}` };
    }

    const parsed = JSON.parse(text) as {
      status?: string;
      data?: { items?: Array<{ name?: string; label?: string }> };
    };
    const items = parsed.data?.items ?? [];
    const channels = items
      .filter((item): item is { name: string; label?: string } => typeof item.name === "string" && item.name.length > 0)
      .map((item) => ({ name: item.name, label: item.label }));

    return { ok: true, channels };
  } catch (err) {
    return {
      ok: false,
      channels: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
