import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Phone, User, Lock, Coins, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCodePicker } from "@/components/ui/CountryCodePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useBiometric } from "@/hooks/useBiometric";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME } from "@/lib/constants";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { z } from "zod";
import { normalizeToE164 } from "@/lib/phoneUtils";

const signUpSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters").max(50),
  phoneNumber: z.string().min(4, "Enter a valid phone number").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
  currency: z.string().min(1, "Select a currency"),
});

const signInSchema = z.object({
  phoneNumber: z.string().min(4, "Enter a valid phone number"),
  password: z.string().min(1, "Password is required"),
});

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ phone: string; password: string } | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    countryCode: "+1",
    phoneNumber: "",
    password: "",
    currency: DEFAULT_CURRENCY,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signUp, signIn } = useAuth();
  const { isAvailable, isEnabled, authenticate, getCredentials, enableBiometric } = useBiometric();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${isSignUp ? "Sign up" : "Sign in"} | ${APP_NAME}`;
  }, [isSignUp]);

  // Auto-trigger biometric on mount if enabled
  useEffect(() => {
    if (isEnabled && isAvailable && !biometricAttempted) {
      setBiometricAttempted(true);
      handleBiometricLogin();
    }
  }, [isEnabled, isAvailable]);

  const handleBiometricLogin = useCallback(async () => {
    setLoading(true);
    try {
      const verified = await authenticate('Sign in to OweLink');
      if (!verified) {
        setLoading(false);
        return;
      }
      const creds = await getCredentials();
      if (!creds) {
        toast({ title: "Biometric error", description: "Could not retrieve saved credentials", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { error } = await signIn(creds.phone, creds.password);
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } catch (e) {
      console.warn('[Auth] Biometric login error:', e);
    } finally {
      setLoading(false);
    }
  }, [authenticate, getCredentials, signIn, navigate, toast]);

  const fullPhoneNumber = useMemo(() => {
    return normalizeToE164(formData.phoneNumber, formData.countryCode);
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

        const { error } = await signUp("", formData.password, formData.username, fullPhoneNumber, formData.currency);

        if (error) {
          toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Welcome to OweLink!", description: "Your account has been created." });
          // Offer biometric after signup
          if (isAvailable) {
            setPendingCredentials({ phone: fullPhoneNumber, password: formData.password });
            setShowBiometricPrompt(true);
          } else {
            localStorage.setItem("onboarding_triggered", "true");
            navigate("/");
          }
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
          // Offer biometric if available and not yet enabled
          if (isAvailable && !isEnabled) {
            setPendingCredentials({ phone: fullPhoneNumber, password: formData.password });
            setShowBiometricPrompt(true);
          } else {
            navigate("/");
          }
        }
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (pendingCredentials) {
      const success = await enableBiometric(pendingCredentials.phone, pendingCredentials.password);
      if (success) {
        toast({ title: "Biometric enabled", description: "You can now sign in with fingerprint or face" });
      }
    }
    setShowBiometricPrompt(false);
    setPendingCredentials(null);
    if (isSignUp) localStorage.setItem("onboarding_triggered", "true");
    navigate("/");
  };

  const handleSkipBiometric = () => {
    setShowBiometricPrompt(false);
    setPendingCredentials(null);
    if (isSignUp) localStorage.setItem("onboarding_triggered", "true");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <span className="text-primary-foreground font-bold text-3xl">O</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">{APP_NAME}</h1>
          <p className="text-muted-foreground mt-2">Track who owes whom, effortlessly.</p>
        </div>

        {/* Biometric button when available but user dismissed auto-prompt */}
        {isEnabled && isAvailable && biometricAttempted && !loading && (
          <Button
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleBiometricLogin}
          >
            <Fingerprint className="h-5 w-5" />
            Sign in with Biometric
          </Button>
        )}

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
              <>
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

                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, currency: value }));
                      setErrors((prev) => ({ ...prev, currency: "" }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Select currency" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          <span className="font-medium">{curr.symbol}</span>
                          <span className="ml-2">{curr.code}</span>
                          <span className="ml-2 text-muted-foreground">- {curr.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="flex gap-2">
                <CountryCodePicker
                  value={formData.countryCode}
                  onChange={(value) => {
                    setFormData((prev) => ({ ...prev, countryCode: value }));
                    setErrors((prev) => ({ ...prev, phoneNumber: "" }));
                  }}
                />
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  placeholder="3121729411"
                  icon={<Phone className="h-4 w-4" />}
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  error={!!errors.phoneNumber}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">We'll save it as: {fullPhoneNumber}</p>
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

      {/* Biometric enable prompt after login/signup */}
      <AlertDialog open={showBiometricPrompt} onOpenChange={setShowBiometricPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              Enable Biometric Login?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Use your fingerprint or face to sign in faster next time. Your credentials will be securely stored on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipBiometric}>Maybe Later</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnableBiometric}>Enable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
