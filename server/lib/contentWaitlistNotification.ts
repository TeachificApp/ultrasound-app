export function buildContentWaitlistAdminNotification({
  title,
  productType,
  name,
  email,
}: {
  title: string;
  productType: string;
  name: string;
  email: string;
}) {
  return {
    to: "admin@allaboutultrasound.com",
    subject: `New Waitlist Signup — ${title}`,
    html: `<h2>New Waitlist Signup</h2><p><strong>Product:</strong> ${title}</p><p><strong>Type:</strong> ${productType}</p><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p>`,
    text: `New Waitlist Signup\nProduct: ${title}\nType: ${productType}\nName: ${name}\nEmail: ${email}`,
  };
}
