export default function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div className="max-w-sm space-y-2">
        <div className="text-slate-400 text-base">Select a chat from the left</div>
        <div className="text-xs text-slate-600">
          All your chats and messages are cached in this browser's IndexedDB, so they'll be
          here next time you open the tab — even offline.
        </div>
      </div>
    </div>
  );
}
