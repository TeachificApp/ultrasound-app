/**
 * EducatorLeadForm — /teach-with-us
 * Educator / instructor interest form for learn.allaboutultrasound.com
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, GraduationCap, Users, BookOpen, ArrowRight } from "lucide-react";

const AAUS_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";

const schema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email address").max(255),
  phone: z.string().max(50).optional(),
  credentials: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

const highlights = [
  {
    icon: GraduationCap,
    title: "Teach CME Classes",
    body: "Lead accredited Ultrasound and/or Echocardiography CME sessions for sonographers and physicians.",
  },
  {
    icon: Users,
    title: "Lead Cohort Groups",
    body: "Guide small-group learning cohorts through structured ultrasound curricula.",
  },
  {
    icon: BookOpen,
    title: "Shape the Curriculum",
    body: "Contribute your clinical expertise to course content, case libraries, and live workshops.",
  },
];

export default function EducatorLeadForm() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const submitMutation = trpc.educator.submitEducatorLead.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (data: FormValues) => {
    submitMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50/40">
      {/* Header */}
      <header className="border-b border-teal-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/" aria-label="All About Ultrasound home">
            <img src={AAUS_LOGO} alt="All About Ultrasound" className="h-9 w-9 rounded-full object-cover" />
          </a>
          <span className="font-semibold text-teal-800 text-sm tracking-wide hidden sm:block">
            All About Ultrasound™
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left — hero copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 uppercase tracking-wider">
              <GraduationCap className="h-3.5 w-3.5" />
              Educator Opportunity
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-4">
              Have a passion for Ultrasound and/or Echocardiography?{" "}
              <span className="text-teal-600">Let's connect.</span>
            </h1>

            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              We're looking for experienced sonographers and physicians who want to teach Ultrasound and/or Echocardiography CME classes or lead a cohort group. Share your expertise with a growing community of ultrasound professionals.
            </p>

            <div className="space-y-5">
              {highlights.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form card */}
          <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-8">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-8 gap-4">
                <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-teal-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Thank you for reaching out!</h2>
                <p className="text-gray-500 text-sm max-w-xs">
                  We've received your information and will be in touch soon about educator opportunities.
                </p>
                <Button
                  variant="outline"
                  className="mt-2 border-teal-200 text-teal-700 hover:bg-teal-50"
                  onClick={() => (window.location.href = "/")}
                >
                  Back to Home
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Educator Interest Form</h2>
                  <p className="text-sm text-gray-500">All fields marked with * are required.</p>
                </div>

                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Jane"
                      {...register("firstName")}
                      className={errors.firstName ? "border-red-400 focus-visible:ring-red-300" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-500">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Smith"
                      {...register("lastName")}
                      className={errors.lastName ? "border-red-400 focus-visible:ring-red-300" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-500">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    {...register("email")}
                    className={errors.email ? "border-red-400 focus-visible:ring-red-300" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 000-0000"
                    {...register("phone")}
                  />
                </div>

                {/* Credentials */}
                <div className="space-y-1.5">
                  <Label htmlFor="credentials" className="text-sm font-medium text-gray-700">
                    Credentials / Certifications
                  </Label>
                  <Input
                    id="credentials"
                    placeholder="e.g. RDMS, RDCS, RVT, MD, DO"
                    {...register("credentials")}
                  />
                  <p className="text-xs text-gray-400">List your relevant credentials separated by commas.</p>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                    Tell Us About Yourself
                  </Label>
                  <Textarea
                    id="message"
                    rows={4}
                    placeholder="Share your clinical background, areas of expertise, and what type of teaching opportunity interests you most..."
                    {...register("message")}
                    className="resize-none"
                  />
                  {errors.message && (
                    <p className="text-xs text-red-500">{errors.message.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || submitMutation.isPending}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold h-11 gap-2"
                >
                  {submitMutation.isPending ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Interest Form
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  By submitting, you agree to be contacted by the All About Ultrasound team regarding educator opportunities.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
