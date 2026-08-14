export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-green-600"
    />
  );
}
