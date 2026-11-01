import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return <UpdatePasswordForm invalidLink={error === "invalid"} />;
}
