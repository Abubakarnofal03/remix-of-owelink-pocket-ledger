import { useEffect, useState, useCallback } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation, useNavigate } from "react-router-dom";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed";
const ONBOARDING_TRIGGERED_KEY = "onboarding_triggered";

// Define tour steps for each page
const homeSteps: DriveStep[] = [
  {
    element: '[data-tour="balance-overview"]',
    popover: {
      title: "Your Balance Overview 💰",
      description: "See at a glance how much is owed to you and how much you owe others. The net balance shows your overall position.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-actions"]',
    popover: {
      title: "Quick Actions ⚡",
      description: "Quickly create a new Bill to split expenses with friends, or an IOU to track simple debts.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="recent-activity"]',
    popover: {
      title: "Recent Activity 📊",
      description: "See your latest transactions at a glance. Tap any item to view details.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-bills"]',
    popover: {
      title: "Bills Tab 📋",
      description: "Manage group expenses! Split dinner bills, trip costs, or any shared expense with multiple people.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-ious"]',
    popover: {
      title: "IOUs Tab 📝",
      description: "Track simple one-on-one debts. Perfect for 'I'll pay you back later' situations. IOUs are grouped by person for easy tracking.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-contacts"]',
    popover: {
      title: "Contacts Tab 👥",
      description: "Access your phone contacts and add custom contacts. Assign nicknames to make transactions easier to identify.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-alerts"]',
    popover: {
      title: "Notifications 🔔",
      description: "Get notified about payment requests, reminders, and when someone settles their debt with you.",
      side: "top",
      align: "center",
    },
  },
];

const billsPageSteps: DriveStep[] = [
  {
    popover: {
      title: "Bills Page 📋",
      description: "This is where you manage all your shared expenses. Let's see what you can do here!",
    },
  },
  {
    element: '[data-tour="new-bill-btn"]',
    popover: {
      title: "Create a New Bill ➕",
      description: "Tap here to split a new expense. You can add multiple participants and split equally or by custom amounts.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="bills-tabs"]',
    popover: {
      title: "Filter Your Bills 🔍",
      description: "'Created' shows bills you made. 'Shared' shows bills others created where you're a participant.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="status-filter"]',
    popover: {
      title: "Status Filter ✅",
      description: "Quickly filter to see only Paid, Unpaid, or All bills.",
      side: "bottom",
      align: "center",
    },
  },
];

const iousPageSteps: DriveStep[] = [
  {
    popover: {
      title: "IOUs Page 📝",
      description: "Track simple debts here. IOUs are grouped by person so you can see your total balance with each contact!",
    },
  },
  {
    element: '[data-tour="new-iou-btn"]',
    popover: {
      title: "Create a New IOU ➕",
      description: "Record when someone owes you or when you owe someone. Set due dates and enable automatic reminders!",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="iou-tabs"]',
    popover: {
      title: "Owed vs You Owe 💵",
      description: "'Owed to me' shows what others owe you. 'I owe' shows your debts to others.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="iou-search"]',
    popover: {
      title: "Search IOUs 🔎",
      description: "Quickly find IOUs by searching names, phone numbers, or descriptions.",
      side: "bottom",
      align: "center",
    },
  },
];

const contactsPageSteps: DriveStep[] = [
  {
    popover: {
      title: "Contacts 👥",
      description: "Your contacts are stored on your device for privacy. You can access phone contacts or add custom ones.",
    },
  },
  {
    element: '[data-tour="add-contact-btn"]',
    popover: {
      title: "Add a Contact ➕",
      description: "Add someone manually if they're not in your phone contacts. Great for new friends or business contacts!",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="contact-search"]',
    popover: {
      title: "Search Contacts 🔎",
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
      description: "Customize your experience here!",
    },
  },
  {
    element: '[data-tour="theme-toggle"]',
    popover: {
      title: "Theme Toggle 🌓",
      description: "Switch between light and dark mode based on your preference.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="currency-setting"]',
    popover: {
      title: "Default Currency 💱",
      description: "Set your preferred currency for all new transactions.",
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
  const startPageTour = useCallback((page: "bills" | "ious" | "contacts" | "settings") => {
    let steps: DriveStep[];
    switch (page) {
      case "bills":
        steps = billsPageSteps;
        break;
      case "ious":
        steps = iousPageSteps;
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
