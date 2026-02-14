import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed";
const ONBOARDING_TRIGGERED_KEY = "onboarding_triggered";
const ONBOARDING_STEP_KEY = "onboarding_step";

export interface TourStep {
  id: string;
  page: string; // route to navigate to
  target?: string; // data-tour selector
  title: string;
  description: string;
  action: "click" | "observe" | "navigate"; // click = wait for user click, observe = just show info, navigate = auto-navigate
  nextOnClick?: boolean; // advance when user clicks the target element
  position?: "top" | "bottom" | "left" | "right" | "center";
}

const tourSteps: TourStep[] = [
  // Welcome
  {
    id: "welcome",
    page: "/",
    title: "Welcome to OweLink! 👋",
    description: "Let's take a quick tour of the app. We'll walk you through every feature step by step. You can skip anytime!",
    action: "observe",
    position: "center",
  },
  // Home - Balance Overview
  {
    id: "home-balance",
    page: "/",
    target: '[data-tour="balance-overview"]',
    title: "Your Balance at a Glance 💰",
    description: "This shows how much others owe you and what you owe them. Green = money coming in, Red = money going out.",
    action: "observe",
    position: "bottom",
  },
  // Home - Quick Actions
  {
    id: "home-actions",
    page: "/",
    target: '[data-tour="quick-actions"]',
    title: "Quick Actions ⚡",
    description: "Create bills, track owes, or log expenses in 2 taps from here.",
    action: "observe",
    position: "top",
  },
  // Navigate to Bills
  {
    id: "nav-bills",
    page: "/",
    target: '[data-tour="nav-bills"]',
    title: "Let's explore Bills! 📋",
    description: "Tap the Bills tab to see how you can split expenses with friends.",
    action: "click",
    nextOnClick: true,
    position: "top",
  },
  // Bills Page
  {
    id: "bills-intro",
    page: "/bills",
    title: "Bills = Group Expenses 📋",
    description: "Perfect for splitting dinner, trips, or shared subscriptions. Everyone sees what they owe!",
    action: "observe",
    position: "center",
  },
  {
    id: "bills-new",
    page: "/bills",
    target: '[data-tour="new-bill-btn"]',
    title: "Create a Bill ➕",
    description: "This button creates a new bill. Add a title, total amount, and participants — the app splits it for you!",
    action: "observe",
    position: "bottom",
  },
  // Navigate to Owes
  {
    id: "nav-owes",
    page: "/bills",
    target: '[data-tour="nav-owes"]',
    title: "Now let's check Owes! 📝",
    description: "Tap the Owes tab to track simple 1-on-1 debts.",
    action: "click",
    nextOnClick: true,
    position: "top",
  },
  // Owes Page
  {
    id: "owes-intro",
    page: "/ious",
    title: "Owes = Simple Debts 📝",
    description: "For quick 'you owe me' or 'I owe you' situations. Track who owes you and what you owe — all in one place.",
    action: "observe",
    position: "center",
  },
  {
    id: "owes-new",
    page: "/ious",
    target: '[data-tour="new-owe-btn"]',
    title: "Track a new Owe ➕",
    description: "Tap here when someone says 'I'll pay you back'. Add who, how much, and when it's due. You can send them reminders too!",
    action: "observe",
    position: "bottom",
  },
  {
    id: "owes-tabs",
    page: "/ious",
    target: '[data-tour="owe-tabs"]',
    title: "Money In vs Money Out 💵",
    description: "'Owed to me' = money others should pay you. 'I owe' = your debts to settle.",
    action: "observe",
    position: "bottom",
  },
  // Navigate to Expenses
  {
    id: "nav-expenses",
    page: "/ious",
    target: '[data-tour="nav-expenses"]',
    title: "Let's check Expenses! 💸",
    description: "Tap the Expenses tab to track your daily spending.",
    action: "click",
    nextOnClick: true,
    position: "top",
  },
  // Expenses Page
  {
    id: "expenses-intro",
    page: "/expenses",
    title: "Expense Tracker 💸",
    description: "Log your daily spending and see where your money goes. Organize them into 'buckets' like Groceries, Trip, or Rent!",
    action: "observe",
    position: "center",
  },
  {
    id: "expenses-add",
    page: "/expenses",
    target: '[data-tour="add-expense-btn"]',
    title: "Log an Expense ➕",
    description: "Tap this to quickly add a new expense. It's fast — just amount and a note!",
    action: "observe",
    position: "bottom",
  },
  // Navigate to Contacts
  {
    id: "nav-contacts",
    page: "/expenses",
    target: '[data-tour="nav-contacts"]',
    title: "Finally, Contacts! 👥",
    description: "Tap Contacts to manage your people.",
    action: "click",
    nextOnClick: true,
    position: "top",
  },
  // Contacts Page
  {
    id: "contacts-intro",
    page: "/contacts",
    title: "Your Contacts 👥",
    description: "Your phone contacts sync here automatically. You can also add custom contacts and give them nicknames for easy finding!",
    action: "observe",
    position: "center",
  },
  // Finish
  {
    id: "finish",
    page: "/contacts",
    title: "You're All Set! 🎉",
    description: "Go back to Home and create your first bill or owe. We'll send reminders so nothing gets forgotten. Enjoy OweLink!",
    action: "observe",
    position: "center",
  },
];

export function useOnboarding() {
  const [isCompleted, setIsCompleted] = useState(() => {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
  });
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const clickHandlerRef = useRef<(() => void) | null>(null);

  const currentStep = isActive ? tourSteps[currentStepIndex] : null;

  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    localStorage.removeItem(ONBOARDING_TRIGGERED_KEY);
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    setIsCompleted(true);
    setIsActive(false);
    setCurrentStepIndex(0);
    // Clean up any click handlers
    if (clickHandlerRef.current) {
      clickHandlerRef.current();
      clickHandlerRef.current = null;
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    localStorage.removeItem(ONBOARDING_TRIGGERED_KEY);
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    setIsCompleted(false);
    setCurrentStepIndex(0);
  }, []);

  const triggerOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_TRIGGERED_KEY, "true");
    setIsCompleted(false);
  }, []);

  const wasTriggered = useCallback(() => {
    return localStorage.getItem(ONBOARDING_TRIGGERED_KEY) === "true";
  }, []);

  // Go to next step
  const nextStep = useCallback(() => {
    const next = currentStepIndex + 1;
    if (next >= tourSteps.length) {
      completeOnboarding();
      navigate("/");
    } else {
      setCurrentStepIndex(next);
      localStorage.setItem(ONBOARDING_STEP_KEY, String(next));
      // Navigate if needed
      const nextStepData = tourSteps[next];
      if (nextStepData.page !== location.pathname) {
        navigate(nextStepData.page);
      }
    }
  }, [currentStepIndex, completeOnboarding, navigate, location.pathname]);

  // Go to previous step
  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prev = currentStepIndex - 1;
      setCurrentStepIndex(prev);
      localStorage.setItem(ONBOARDING_STEP_KEY, String(prev));
      const prevStepData = tourSteps[prev];
      if (prevStepData.page !== location.pathname) {
        navigate(prevStepData.page);
      }
    }
  }, [currentStepIndex, navigate, location.pathname]);

  // Start full tour
  const startFullTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
    localStorage.setItem(ONBOARDING_STEP_KEY, "0");
    if (location.pathname !== "/") {
      navigate("/");
    }
  }, [location.pathname, navigate]);

  // Listen for clicks on target elements (for "click" action steps)
  useEffect(() => {
    if (!isActive || !currentStep?.nextOnClick || !currentStep.target) return;

    const handleClick = () => {
      // Small delay to let the navigation happen
      setTimeout(() => nextStep(), 300);
    };

    // Wait for element to be in DOM
    const checkInterval = setInterval(() => {
      const el = document.querySelector(currentStep.target!);
      if (el) {
        clearInterval(checkInterval);
        el.addEventListener("click", handleClick, { once: true });
        clickHandlerRef.current = () => {
          el.removeEventListener("click", handleClick);
        };
      }
    }, 100);

    return () => {
      clearInterval(checkInterval);
      if (clickHandlerRef.current) {
        clickHandlerRef.current();
        clickHandlerRef.current = null;
      }
    };
  }, [isActive, currentStepIndex, currentStep, nextStep]);

  // Auto-start for new users
  useEffect(() => {
    if (wasTriggered() && !isCompleted && location.pathname === "/" && !isActive) {
      const timer = setTimeout(() => {
        startFullTour();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [wasTriggered, isCompleted, location.pathname, isActive, startFullTour]);

  // Page-specific tour (kept for settings replay)
  const startPageTour = useCallback((_page: string) => {
    startFullTour();
  }, [startFullTour]);

  return {
    isCompleted,
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: tourSteps.length,
    startFullTour,
    startPageTour,
    nextStep,
    prevStep,
    completeOnboarding,
    resetOnboarding,
    triggerOnboarding,
  };
}
