# Railway-to-Manus API Integration

The Railway-hosted application uses the public **Manus API v2** only from server code. It remains independently hosted on Railway, with Railway MySQL and GitHub-based authentication unchanged. The API key is named `MANUS_API_KEY` and must exist only in Railway’s encrypted environment variables; it must not be committed, logged, sent to browsers, or substituted with `BUILT_IN_FORGE_*` values from the managed hosting environment.

| Concern | Railway implementation |
|---|---|
| Authentication | Send `x-manus-api-key` only from the Railway server. |
| Connection verification | `GET /v2/task.list?limit=1` confirms key access without creating a task. |
| AI execution | `POST /v2/task.create` creates a private, non-interactive task. |
| Completion | Poll `task.detail` and `task.listMessages`; do not automatically confirm an agent action. |
| Structured outputs | Supply `structured_output_schema` and read the `structured_output_result` event. |
| Browser exposure | No API-key environment variable is prefixed `VITE_`; the browser communicates only with application procedures. |

The existing AI wrapper selects this task-based API when `MANUS_API_KEY` is configured. It retains its configurable direct-model fallback only for environments intentionally configured for that separate path.

## Operational notes

Manus tasks are asynchronous. A task that needs information or a sensitive action can enter a waiting state; the application surfaces a controlled error instead of silently confirming the action. Railway must keep the key in its Variables panel and redeploy after code/configuration changes.

## References

[1]: https://open.manus.im/docs/v2/task.create "Manus API v2 task.create"
[2]: https://open.manus.im/docs/v2/task.listMessages "Manus API v2 task.listMessages"
[3]: https://open.manus.im/docs/v2/structured-output "Manus API v2 Structured Output"
[4]: https://open.manus.im/docs/v2/task-lifecycle "Manus API v2 Task Lifecycle"
