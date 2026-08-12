export abstract class ValueObject<TProps> {
  protected readonly props: TProps;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  equals(other: ValueObject<TProps> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
