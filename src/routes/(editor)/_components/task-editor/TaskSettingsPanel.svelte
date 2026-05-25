<script lang="ts">
  import type { TriggerType, WebhookDelivery } from "../task-editor-model";

  let {
    name = $bindable(""),
    description = $bindable(""),
    trigger = $bindable<TriggerType | "">(""),
    trigger_value = $bindable(""),
    timezone = $bindable("UTC"),
    webhook_url = "",
    deliveries = [],
    webhookStatus = "",
    webhookBusy = false,
    webhookManageDisabled = false,
    onRotateWebhook,
    onDisableWebhook,
    error = "",
    onClose
  }: {
    name?: string;
    description?: string;
    trigger?: TriggerType | "";
    trigger_value?: string;
    timezone?: string;
    webhook_url?: string;
    deliveries?: WebhookDelivery[];
    webhookStatus?: string;
    webhookBusy?: boolean;
    webhookManageDisabled?: boolean;
    onRotateWebhook?: () => void;
    onDisableWebhook?: () => void;
    error?: string;
    onClose: () => void;
  } = $props();

  let copiedEndpoint = $state(false);

  function selectTrigger(next: TriggerType) {
    const previous = trigger;
    trigger = next;
    if (next === "manual") {
      trigger_value = "";
      timezone = "UTC";
    }
    if (next === "cron" && previous !== "cron") trigger_value = "0 9 * * *";
    if (next === "webhook" && previous !== "webhook") trigger_value = "";
  }

  async function copyEndpoint(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    copiedEndpoint = true;
    setTimeout(() => {
      copiedEndpoint = false;
    }, 1600);
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}
>
  <div class="settings-modal" aria-label="Task settings" role="dialog" aria-modal="true">
    <div class="section-head">
      <div>
        <h2>Task settings</h2>
        <p>Stored with the task.</p>
      </div>
    </div>

    {#if error}
      <p class="error-message">{error}</p>
    {/if}

    <div class="field-grid">
      <label>
        <span>Name</span>
        <input bind:value={name} required />
      </label>

      <label>
        <span>Description</span>
        <textarea bind:value={description} rows="2"></textarea>
      </label>
    </div>

    <div class="trigger-field">
      <span>Trigger</span>
      <div class="trigger-options" role="group" aria-label="Trigger type">
        <button class:active={trigger === "webhook"} type="button" onclick={() => selectTrigger("webhook")}
          >Webhook</button
        >
        <button class:active={trigger === "cron"} type="button" onclick={() => selectTrigger("cron")}>Cron</button>
        <button class:active={trigger === "manual"} type="button" onclick={() => selectTrigger("manual")}>Manual</button
        >
      </div>
    </div>

    {#if trigger === "cron"}
      <div class="field-grid two">
        <label>
          <span>Cron expression</span>
          <input bind:value={trigger_value} placeholder="0 9 * * *" required />
        </label>
        <label>
          <span>Timezone</span>
          <input bind:value={timezone} placeholder="UTC" required />
        </label>
      </div>
    {:else if trigger === "webhook"}
      <div class="webhook-settings">
        <div class="readonly-row">
          <span>Endpoint</span>
          <div class="endpoint-row">
            <code>{webhook_url || "Generated after save"}</code>
          </div>
        </div>

        {#if webhook_url}
          <div class="webhook-actions">
            <button class="webhook-action copy-action" type="button" onclick={() => copyEndpoint(webhook_url)}>
              {copiedEndpoint ? "Copied URL" : "Copy URL"}
            </button>
            <div class="webhook-danger-actions">
              <button
                class="webhook-action"
                type="button"
                disabled={webhookBusy || webhookManageDisabled}
                onclick={() => onRotateWebhook?.()}
              >
                {webhookBusy ? "Working..." : "Rotate URL"}
              </button>
              <button
                class="webhook-action danger-button"
                type="button"
                disabled={webhookBusy || webhookManageDisabled}
                onclick={() => {
                  if (confirm("Disable this webhook endpoint?")) onDisableWebhook?.();
                }}
              >
                Disable
              </button>
            </div>
          </div>

          {#if webhookManageDisabled}
            <p class="webhook-note">Save current edits before changing the webhook URL.</p>
          {:else if webhookStatus}
            <p class="webhook-note">{webhookStatus}</p>
          {/if}

          <div class="delivery-list">
            <strong>Recent deliveries</strong>
            {#if deliveries.length === 0}
              <p>No webhook deliveries yet.</p>
            {:else}
              {#each deliveries as delivery}
                <a href={`/runs/${delivery.id}`} class="delivery-row">
                  <span class="delivery-status {delivery.status}">{delivery.status}</span>
                  <span>{delivery.queued}</span>
                  <span>{delivery.duration}</span>
                </a>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="readonly-row">
        <span>Schedule</span>
        <code>N/A</code>
      </div>
    {/if}

    <div class="modal-actions">
      <button class="primary-button" type="button" onclick={onClose}>Done</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    z-index: 50;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(8, 10, 14, 0.58);
    padding: 18px;
  }

  .settings-modal {
    width: min(560px, 100%);
    max-height: min(720px, calc(100vh - 36px));
    overflow: auto;
    border: 1px solid #343b46;
    border-radius: 8px;
    background: #1f2329;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
    padding: 16px;
  }

  :global(:root.light) .settings-modal {
    border-color: #d7dae0;
    background: #ffffff;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
  }

  .section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: #d7dae0;
    font-size: 13px;
    font-weight: 850;
  }

  p {
    color: #7f8794;
    font-size: 12px;
    line-height: 1.4;
  }

  .error-message {
    margin: 0 0 12px;
    border: 1px solid rgba(224, 108, 117, 0.35);
    border-radius: 6px;
    background: rgba(224, 108, 117, 0.1);
    color: #fb7a7a;
    padding: 9px 10px;
    font-weight: 750;
  }

  :global(:root.light) .error-message {
    border-color: rgba(209, 36, 47, 0.24);
    background: rgba(209, 36, 47, 0.07);
    color: #d1242f;
  }

  :global(:root.light) h2 {
    color: #1f2329;
  }

  :global(:root.light) p {
    color: #696c77;
  }

  .field-grid {
    display: grid;
    gap: 12px;
  }

  .field-grid.two {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 0.45fr);
    margin-top: 12px;
  }

  label,
  .trigger-field {
    display: grid;
    gap: 6px;
  }

  label span,
  .trigger-field > span,
  .readonly-row span {
    color: #7f8794;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  :global(:root.light) label span,
  :global(:root.light) .trigger-field > span,
  :global(:root.light) .readonly-row span {
    color: #696c77;
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid #343b46;
    border-radius: 6px;
    background: #282c34;
    color: #d7dae0;
    font: inherit;
    padding: 9px 10px;
    outline: none;
  }

  textarea {
    resize: vertical;
  }

  input:focus,
  textarea:focus {
    border-color: #61afef;
    box-shadow: 0 0 0 2px rgba(97, 175, 239, 0.18);
  }

  :global(:root.light) input,
  :global(:root.light) textarea {
    border-color: #d7dae0;
    background: #fbfbfb;
    color: #1f2329;
  }

  .trigger-field {
    margin-top: 12px;
  }

  .trigger-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid #343b46;
    border-radius: 7px;
    overflow: hidden;
  }

  :global(:root.light) .trigger-options {
    border-color: #d7dae0;
  }

  .trigger-options button {
    min-height: 34px;
    border: 0;
    border-right: 1px solid #343b46;
    background: #282c34;
    color: #abb2bf;
    font-weight: 800;
  }

  .trigger-options button:last-child {
    border-right: 0;
  }

  .trigger-options button.active {
    background: #2f3845;
    color: #ffffff;
  }

  :global(:root.light) .trigger-options button {
    border-right-color: #d7dae0;
    background: #fbfbfb;
    color: #383a42;
  }

  :global(:root.light) .trigger-options button.active {
    background: #edf1f7;
    color: #111827;
  }

  .readonly-row {
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }

  .webhook-settings {
    display: grid;
    gap: 10px;
  }

  .endpoint-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .readonly-row code {
    overflow: hidden;
    color: #abb2bf;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .endpoint-row code {
    min-width: 0;
    flex: 1;
    color: #98c379;
  }

  :global(:root.light) .endpoint-row code {
    color: #2f8f46;
  }

  .webhook-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .webhook-danger-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .webhook-action {
    min-height: 30px;
    border: 0;
    background: transparent;
    color: #abb2bf;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 0;
  }

  .copy-action {
    justify-self: start;
  }

  .webhook-action:hover {
    color: #d7dae0;
    text-decoration: underline;
  }

  :global(:root.light) .webhook-action {
    color: #696c77;
  }

  :global(:root.light) .webhook-action:hover {
    color: #1f2329;
  }

  .danger-button {
    color: #fb7a7a;
  }

  :global(:root.light) .danger-button {
    color: #d1242f;
  }

  .danger-button:hover {
    color: #fb7a7a;
  }

  :global(:root.light) .danger-button:hover {
    color: #d1242f;
  }

  .webhook-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .webhook-note,
  .delivery-list p {
    margin: 0;
    color: #7f8794;
    font-size: 12px;
  }

  :global(:root.light) .webhook-note,
  :global(:root.light) .delivery-list p {
    color: #696c77;
  }

  .delivery-list {
    display: grid;
    gap: 7px;
    border-top: 1px solid #343b46;
    padding-top: 10px;
  }

  :global(:root.light) .delivery-list {
    border-top-color: #d7dae0;
  }

  .delivery-list strong {
    color: #7f8794;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  :global(:root.light) .delivery-list strong {
    color: #696c77;
  }

  .delivery-row {
    min-width: 0;
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 64px;
    gap: 8px;
    align-items: center;
    color: #abb2bf;
    font-size: 12px;
    text-decoration: none;
  }

  :global(:root.light) .delivery-row {
    color: #383a42;
  }

  .delivery-row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delivery-status {
    color: #7f8794;
    text-transform: capitalize;
  }

  .delivery-status.success {
    color: #98c379;
  }

  .delivery-status.failed,
  .delivery-status.canceled {
    color: #fb7a7a;
  }

  .delivery-status.queued,
  .delivery-status.running {
    color: #61afef;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .modal-actions button {
    min-height: 34px;
    border-radius: 6px;
    padding: 7px 14px;
  }

  :global(:root.light) .readonly-row code {
    color: #383a42;
  }

  @media (max-width: 720px) {
    .field-grid.two {
      grid-template-columns: 1fr;
    }
  }
</style>
