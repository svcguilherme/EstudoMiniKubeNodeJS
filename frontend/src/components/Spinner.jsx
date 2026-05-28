export default function Spinner({ text = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
