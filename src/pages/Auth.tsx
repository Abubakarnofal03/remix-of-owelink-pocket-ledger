import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Phone, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME } from "@/lib/constants";
import { z } from "zod";

type CountryCode = {
  code: string;
  label: string;
};

const COUNTRY_CODES: CountryCode[] = [
  { code: "+1", label: "United States" },
  { code: "+44", label: "United Kingdom" },
  { code: "+61", label: "Australia" },
  { code: "+91", label: "India" },
  { code: "+92", label: "Pakistan" },
  { code: "+971", label: "UAE" },
];

const signUpSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters").max(50),
  phoneNumber: z.string().min(4, "Enter a valid phone number").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signInSchema = z.object({
  phoneNumber: z.string().min(4, "Enter a valid phone number"),
  password: z.string().min(1, "Password is required"),
});

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    countryCode: "+1",
    phoneNumber: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signUp, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${isSignUp ? "Sign up" : "Sign in"} | ${APP_NAME}`;
  }, [isSignUp]);

  const fullPhoneNumber = useMemo(() => {
    const localDigits = formData.phoneNumber.replace(/[^0-9]/g, "");
    return `${formData.countryCode}${localDigits}`;
  }, [formData.countryCode, formData.phoneNumber]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      if (isSignUp) {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const digitsOnly = fullPhoneNumber.replace(/[^0-9]/g, "");
        const email = `${digitsOnly}@owelink.app`;
        const { error } = await signUp(
          email,
          formData.password,
          formData.username,
          fullPhoneNumber
        );

        if (error) {
          toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Welcome to Owelink!", description: "Your account has been created." });
          navigate("/");
        }
      } else {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(fullPhoneNumber, formData.password);

        if (error) {
          toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <span className="text-primary-foreground font-bold text-3xl">O</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">{APP_NAME}</h1>
          <p className="text-muted-foreground mt-2">Track who owes whom, effortlessly.</p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex gap-2 mb-6">
            <Button variant={!isSignUp ? "default" : "ghost"} className="flex-1" onClick={() => setIsSignUp(false)}>
              Sign In
            </Button>
            <Button variant={isSignUp ? "default" : "ghost"} className="flex-1" onClick={() => setIsSignUp(true)}>
              Sign Up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Your name"
                  icon={<User className="h-4 w-4" />}
                  value={formData.username}
                  onChange={handleChange}
                  error={!!errors.username}
                />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, countryCode: value }));
                    setErrors((prev) => ({ ...prev, phoneNumber: "" }));
                  }}
                >
                  <SelectTrigger aria-label="Select country code">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  placeholder="3121729411"
                  icon={<Phone className="h-4 w-4" />}
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  error={!!errors.phoneNumber}
                />
              </div>
              <p className="text-xs text-muted-foreground">We’ll save it as: {fullPhoneNumber}</p>
              {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
