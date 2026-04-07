export default function MessagesPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Messages</h1>
      <p className="text-gray-500 mb-8">Chat with your groups, hosts, and the SPLYT team.</p>
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
        <div className="w-16 h-16 bg-ocean-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-ocean-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Coming Soon</h2>
        <p className="text-sm text-gray-500">This feature is being built. Check back soon.</p>
      </div>
    </div>
  );
}
