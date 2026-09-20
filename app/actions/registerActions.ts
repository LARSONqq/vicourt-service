"use server";

// Public registration cannot assign a trusted application identity.
// Kept as a denied action so stale deployed forms also fail safely.
export async function registerUser(_input: {
  fullName: string; email: string; password: string; companyCode: string;
}) {
  void _input;
  return {
    success: false,
    message: "Облікові записи створює адміністратор ViCourt. Зверніться до адміністратора.",
    requiresEmailConfirmation: false,
  };
}
