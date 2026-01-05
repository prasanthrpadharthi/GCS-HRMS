"use client"

export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-amber-700 font-medium animate-pulse">{message}</p>
    </div>
  )
}

export function LoadingOverlay({ message = "Processing..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 shadow-2xl border border-amber-200">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-amber-900 font-semibold text-lg">{message}</p>
        </div>
      </div>
    </div>
  )
}

export function ButtonLoader() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      <span>Processing...</span>
    </div>
  )
}
