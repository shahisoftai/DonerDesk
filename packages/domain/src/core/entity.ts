export abstract class Entity<TId> {
  protected readonly _id: TId;
  protected readonly _createdAt: Date;
  protected _updatedAt: Date;

  /**
   * `updatedAt` is supplied when rehydrating a persisted entity so optimistic
   * concurrency checks compare against the stored value, not the creation time.
   */
  protected constructor(id: TId, createdAt?: Date, updatedAt?: Date) {
    this._id = id;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = updatedAt ?? this._createdAt;
  }

  get id(): TId {
    return this._id;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  protected touch(): void {
    this._updatedAt = new Date();
  }

  equals(other: Entity<TId> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    return this._id === other._id;
  }
}
