const watchedDraftIds = new Set<string>();

export function watchPublishedDraft(draftId: string) {
  watchedDraftIds.add(draftId);
}

export function isWatchedPublishedDraft(draftId: string | null | undefined) {
  return Boolean(draftId && watchedDraftIds.has(draftId));
}

export function clearWatchedPublishedDraft(draftId: string | null | undefined) {
  if (draftId) watchedDraftIds.delete(draftId);
}
