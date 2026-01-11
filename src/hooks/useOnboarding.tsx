import { useEffect, useState, useCallback } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation, useNavigate } from "react-router-dom";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed";
const ONBOARDING_TRIGGERED_KEY = "onboarding_triggered";

// Welcome step (shown first)
const welcomeStep: DriveStep = {
  popover: {
    title: "Welcome to Owey! 👋",
    description: "Let's take a quick tour to help you get started. We'll show you how to track money with friends in just a few taps!",
    side: "over",
    align: "center",
  },
};

// Define tour steps for each page
const homeSteps: DriveStep[] = [
  welcomeStep,
  {
    element: '[data-tour="balance-overview"]',
    popover: {
      title: "Your Balance at a Glance 💰",
      description: "See how much others owe you and what you owe them. Green means you're owed money!",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-actions"]',
    popover: {
      title: "Create in 2 Taps! ⚡",
      description: "Bills are for splitting with groups (dinner, trips). IOUs are for simple 1-on-1 debts ('I'll pay you back').",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-bills"]',
    popover: {
      title: "Bills = Group Expenses 📋",
      description: "Split dinner, trips, or any shared cost. Just add participants and let the app calculate who owes what!",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-ious"]',
    popover: {
      title: "IOUs = Simple Debts 📝",
      description: "For quick 'you owe me' situations. Track who owes you and what you owe others - all in one place.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-expenses"]',
    popover: {
      title: "Track Your Spending 💸",
      description: "Log daily expenses and organize them into 'buckets' like 'Trip' or 'Groceries' to see where your money goes.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-contacts"]',
    popover: {
      title: "Your Contacts 👥",
      description: "Access phone contacts or add custom ones. Give nicknames to make finding people easier!",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "You're All Set! 🎉",
      description: "Start by creating your first Bill or IOU. Tap the + button on the home screen to begin. We'll send you reminders so nothing gets forgotten!",
      side: "over",
      align: "center",
    },
  },
];

const billsPageSteps: DriveStep[] = [
  {
    popover: {
      title: "Bills: Split Expenses Easily 📋",
      description: "Perfect for group expenses - dinners, trips, shared subscriptions. Let's see how it works!",
    },
  },
  {
    element: '[data-tour="new-bill-btn"]',
    popover: {
      title: "Create Your First Bill ➕",
      description: "Tap here to split an expense. Add a title (like 'Dinner at Mario's'), the total amount, and who's involved.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="bills-tabs"]',
    popover: {
      title: "Your Bills 🔍",
      description: "'Created' = bills you made. 'Shared' = bills others added you to.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="status-filter"]',
    popover: {
      title: "Quick Filters ✅",
      description: "See only unpaid bills, paid bills, or all of them.",
      side: "bottom",
      align: "center",
    },
  },
];

const iousPageSteps: DriveStep[] = [
  {
    popover: {
      title: "IOUs: Track Simple Debts 📝",
      description: "When someone owes you (or you owe them), log it here. We'll group everything by person!",
    },
  },
  {
    element: '[data-tour="new-iou-btn"]',
    popover: {
      title: "Record a Debt ➕",
      description: "Tap here when someone says 'I'll pay you back'. Add who, how much, and optionally when it's due.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="iou-tabs"]',
    popover: {
      title: "Money In vs Money Out 💵",
      description: "'Owed to me' = money coming your way. 'I owe' = your debts to settle.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="iou-search"]',
    popover: {
      title: "Find Anyone Fast 🔎",
      description: "Search by name or phone number to find IOUs quickly.",
      side: "bottom",
      align: "center",
    },
  },
];

const expensesPageSteps: DriveStep[] = [
  {
    popover: {
      title: "Expense Tracker 💸",
      description: "Log your daily spending and see where your money goes. Organize expenses into 'buckets' for better insights!",
    },
  },
  {
    element: '[data-tour="add-expense-btn"]',
    popover: {
      title: "Log an Expense ➕",
      description: "Tap here to add a new expense. Quick and simple!",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="expense-summary"]',
    popover: {
      title: "Spending Summary 📊",
      description: "See your total spending for today, this week, or this month.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="expense-tabs"]',
    popover: {
      title: "Expenses & Buckets 📁",
      description: "View all expenses or organize them into buckets. Long-press any expense to move it to a bucket!",
      side: "bottom",
      align: "center",
    },
  },
];

const contactsPageSteps: DriveStep[] = [
  {
    popover: {
      title: "Contacts 👥",
      description: "Your contacts are stored locally for privacy. Access phone contacts or add custom ones.",
    },
  },
  {
    element: '[data-tour="add-contact-btn"]',
    popover: {
      title: "Add Someone New ➕",
      description: "Add a contact manually if they're not in your phone.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="contact-search"]',
    popover: {
      title: "Quick Search 🔎",
      description: "Find contacts by name or phone number.",
      side: "bottom",
      align: "center",
    },
  },
];

const settingsPageSteps: DriveStep[] = [
  {
    popover: {
      title: "Settings ⚙️",
      description: "Customize your app experience here!",
    },
  },
  {
    element: '[data-tour="theme-toggle"]',
    popover: {
      title: "Light or Dark? 🌓",
      description: "Switch between light and dark mode.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="currency-setting"]',
    popover: {
      title: "Your Currency 💱",
      description: "Set your default currency for all transactions.",
      side: "bottom",
      align: "center",
    },
  },
];

export function useOnboarding() {
  const [isCompleted, setIsCompleted] = useState(() => {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
  });
  const [isActive, setIsActive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Mark onboarding as completed
  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    localStorage.removeItem(ONBOARDING_TRIGGERED_KEY);
    setIsCompleted(true);
    setIsActive(false);
  }, []);

  // Reset onboarding (for testing or restart)
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    localStorage.removeItem(ONBOARDING_TRIGGERED_KEY);
    setIsCompleted(false);
  }, []);

  // Trigger onboarding for new signup
  const triggerOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_TRIGGERED_KEY, "true");
    setIsCompleted(false);
  }, []);

  // Check if onboarding was triggered
  const wasTriggered = useCallback(() => {
    return localStorage.getItem(ONBOARDING_TRIGGERED_KEY) === "true";
  }, []);

  // Start the full tour
  const startFullTour = useCallback(() => {
    if (location.pathname !== "/") {
      navigate("/");
      // Wait for navigation to complete
      setTimeout(() => startFullTour(), 100);
      return;
    }

    setIsActive(true);

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayClickBehavior: "close",
      stagePadding: 8,
      popoverClass: "tour-popover",
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Got it! ✓",
      steps: homeSteps,
      onDestroyed: () => {
        completeOnboarding();
      },
    });

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      driverObj.drive();
    }, 500);
  }, [location.pathname, navigate, completeOnboarding]);

  // Start page-specific tour
  const startPageTour = useCallback((page: "bills" | "ious" | "expenses" | "contacts" | "settings") => {
    let steps: DriveStep[];
    switch (page) {
      case "bills":
        steps = billsPageSteps;
        break;
      case "ious":
        steps = iousPageSteps;
        break;
      case "expenses":
        steps = expensesPageSteps;
        break;
      case "contacts":
        steps = contactsPageSteps;
        break;
      case "settings":
        steps = settingsPageSteps;
        break;
      default:
        return;
    }

    setIsActive(true);

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayClickBehavior: "close",
      stagePadding: 8,
      popoverClass: "tour-popover",
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Got it! ✓",
      steps,
      onDestroyed: () => {
        setIsActive(false);
      },
    });

    setTimeout(() => {
      driverObj.drive();
    }, 300);
  }, []);

  // Auto-start onboarding for new users
  useEffect(() => {
    if (wasTriggered() && !isCompleted && location.pathname === "/") {
      // Small delay to let the page render
      const timer = setTimeout(() => {
        startFullTour();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [wasTriggered, isCompleted, location.pathname, startFullTour]);

  return {
    isCompleted,
    isActive,
    startFullTour,
    startPageTour,
    completeOnboarding,
    resetOnboarding,
    triggerOnboarding,
  };
}
