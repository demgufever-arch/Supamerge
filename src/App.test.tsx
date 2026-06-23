import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders landing page on load', () => {
    render(<App />);
    expect(screen.getByText(/Unify Your Supabase/i)).toBeInTheDocument();
  });

  it('shows Launch Dashboard button', () => {
    render(<App />);
    expect(screen.getByText('Launch Dashboard')).toBeInTheDocument();
  });

  it('shows feature section headings', () => {
    render(<App />);
    expect(screen.getByText(/Core Capabilities/i)).toBeInTheDocument();
    expect(screen.getByText(/Simple Workflow/i)).toBeInTheDocument();
  });
});
