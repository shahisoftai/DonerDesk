export function CommentsDisclosure({ entityType, entityId }: { entityType: string; entityId: string }) {
  return <button type="button" data-testid="comments" data-entity={`${entityType}:${entityId}`}>Add a comment</button>;
}
