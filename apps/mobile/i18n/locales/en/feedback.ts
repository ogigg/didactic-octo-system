export const feedback = {
  header: {
    title: "Feedback",
    subtitle: "Help us improve by reporting bugs or suggesting features",
  },
  type: {
    title: "What type of feedback?",
    bug: "Bug Report",
    feature: "Feature Request",
  },
  title: {
    label: "Title",
    placeholder: "Brief summary of your feedback...",
  },
  description: {
    label: "Description",
    subtitle: "Please provide as much detail as possible",
    placeholder: "Describe the issue or your feature idea in detail...",
    charCount: "{{count}}/{{max}} characters",
  },
  submit: {
    button: "Send Feedback",
    sending: "Sending...",
  },
  success: {
    title: "Thank you!",
    message: "Your feedback has been received. We'll review it soon.",
    button: "Done",
  },
  error: {
    title: "Error",
    message: "Failed to send feedback. Please try again.",
  },
  recovery: {
    title: "Workout generation recovery",
    description:
      "My workout could not be generated after repeated attempts.\n\nSupport reference: {{reference}}\n\nWhat happened:",
  },
  validation: {
    titleRequired: "Title is required",
    titleTooLong: "Title must be less than 100 characters",
    descriptionRequired: "Description is required",
    descriptionTooLong: "Description must be less than 2000 characters",
  },
} as const;
