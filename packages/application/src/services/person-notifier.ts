import { emailAllowed } from "@donordesk/domain";
import type { IIdGenerator, INotificationPort } from "../ports/core.js";
import type { INotificationPreferences, IPersonNotifier, PersonNotification } from "../ports/reminders.js";
import type { INotificationRepository } from "../ports/support.js";

export class PersonNotifier implements IPersonNotifier {
  constructor(
    private readonly ids: IIdGenerator, private readonly inApp: INotificationRepository, private readonly email: INotificationPort,
    private readonly prefs: INotificationPreferences,
  ) {}

  async send(n: PersonNotification): Promise<void> {
    try {
      await this.inApp.create({
        id: this.ids.generate(), tenantId: n.tenantId.toString(), recipientId: n.recipientId, type: n.type, title: n.title, message: n.message,
        ...(n.relatedEntityType ? { relatedEntityType: n.relatedEntityType } : {}), ...(n.relatedEntityId ? { relatedEntityId: n.relatedEntityId } : {}),
      });
      const mode = await this.prefs.get(n.tenantId, n.recipientId);
      if (mode.ok && emailAllowed(mode.value, n.urgent)) {
        await this.email.notify({
          tenantId: n.tenantId, recipientId: n.recipientId, type: n.type, title: n.title, message: n.message,
          ...(n.relatedEntityType ? { relatedEntityType: n.relatedEntityType } : {}), ...(n.relatedEntityId ? { relatedEntityId: n.relatedEntityId } : {}),
        });
      }
    } catch {
      /* telling someone is additive: the change that caused it already succeeded */
    }
  }
}
