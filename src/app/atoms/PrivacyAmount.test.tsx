import React from 'react';
import { render, screen } from '@testing-library/react';

import { PrivacyAmount } from './PrivacyAmount';

jest.mock('lib/store/zustand/ui.store', () => ({
  usePrivacyMode: jest.fn()
}));

import { usePrivacyMode } from 'lib/store/zustand/ui.store';

const mockUsePrivacyMode = usePrivacyMode as jest.Mock;

describe('PrivacyAmount', () => {
  it('renders children when privacyMode is false', () => {
    mockUsePrivacyMode.mockReturnValue(false);
    render(<PrivacyAmount>$123.45</PrivacyAmount>);
    expect(screen.getByText('$123.45')).toBeInTheDocument();
  });

  it('does not render children when privacyMode is true', () => {
    mockUsePrivacyMode.mockReturnValue(true);
    render(<PrivacyAmount>$123.45</PrivacyAmount>);
    expect(screen.queryByText('$123.45')).not.toBeInTheDocument();
  });

  it('renders •••• when privacyMode is true', () => {
    mockUsePrivacyMode.mockReturnValue(true);
    render(<PrivacyAmount>$123.45</PrivacyAmount>);
    expect(screen.getByText('••••')).toBeInTheDocument();
  });

  it('applies className when privacyMode is false', () => {
    mockUsePrivacyMode.mockReturnValue(false);
    render(<PrivacyAmount className="test-class">$1</PrivacyAmount>);
    expect(document.querySelector('.test-class')).not.toBeNull();
  });

  it('applies className when privacyMode is true', () => {
    mockUsePrivacyMode.mockReturnValue(true);
    render(<PrivacyAmount className="test-class">$1</PrivacyAmount>);
    expect(document.querySelector('.test-class')).not.toBeNull();
  });

  it('has aria-label="Hidden balance" when masked', () => {
    mockUsePrivacyMode.mockReturnValue(true);
    render(<PrivacyAmount>$1</PrivacyAmount>);
    expect(screen.getByLabelText('Hidden balance')).toBeInTheDocument();
  });

  it('does not have aria-label="Hidden balance" when visible', () => {
    mockUsePrivacyMode.mockReturnValue(false);
    render(<PrivacyAmount>$1</PrivacyAmount>);
    expect(screen.queryByLabelText('Hidden balance')).not.toBeInTheDocument();
  });
});
