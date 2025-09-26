interface ResourceNotFoundProps {
  title: string;
  message: string;
  backUrl: string;
  backText: string;
  icon?: React.ReactNode;
  secondaryUrl?: string;
  secondaryText?: string;
}

export default function ResourceNotFound({
  title,
  message,
  backUrl,
  backText,
  icon,
  secondaryUrl,
  secondaryText,
}: ResourceNotFoundProps) {
  const defaultIcon = (
    <svg
      className="w-16 h-16 mx-auto text-red-500 mb-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 text-center">
        <div className="mb-6">
          {icon || defaultIcon}
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <p className="text-gray-400 mb-6">{message}</p>
        </div>
        <div className="space-y-3">
          <a
            href={backUrl}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {backText}
          </a>
          {secondaryUrl && secondaryText && (
            <a
              href={secondaryUrl}
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {secondaryText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
