import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders landing page on load', () => {
    render(<App />);
    expect(screen.getByText(/Unify Your Supabase/i)).toBeTruthy();
  });

  it('shows Launch Dashboard button', () => {
    render(<App />);
    expect(screen.getByText('Launch Dashboard')).toBeTruthy();
  });

  it('shows three feature section headings', () => {
    render(<App />);
    expect(screen.getByText(/Core Capabilities/i)).toBeTruthy();
    expect(screen.getByText(/Simple Workflow/i)).toBeTruthy();
  });
});
