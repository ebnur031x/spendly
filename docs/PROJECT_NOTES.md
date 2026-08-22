# Project Notes

## Landing Page (`Landing.jsx`)

The landing page is a React component for Spendly's public homepage. It is primarily frontend/presentation code, not backend or database logic.

### Main responsibilities

- Uses React Router for navigation with `Link`, `Navigate`, and `useNavigate`.
- Uses `useAuth()` to check authentication state.
- Redirects authenticated users from the landing page to `/dashboard`.
- Provides navigation links for Features, Budgets, For students, and Pricing.
- Builds reusable decorative/UI components:
  - `FloatingCard`
  - `SavingsBadge`
  - `TransactionCard`
  - `BudgetProgress`
  - `DonutChart`
  - `FoodChip`
  - `UnderBudgetBadge`
  - `FeatureCard`
  - `BudgetShowcase`
- Renders the hero section, feature section, budget showcase, student-focused section, pricing section, and footer.
- The hero CTA fades the page and then navigates to `/signup` after 340ms.
- The budget and expense numbers shown in the landing-page previews are hard-coded presentation examples; they are not the user's live financial data.

### Key React concepts used

- Functional components
- JSX
- Props
- `useState`
- Custom hooks (`useAuth`)
- Programmatic navigation
- Conditional rendering
- Array `.map()` for repeated UI
- Inline styles and CSS custom properties
- SVG circles for chart/ring visualizations

### Important distinction

This file describes what visitors see and how the landing page behaves. Actual expense persistence, authentication implementation, and database behavior live elsewhere in the project.
