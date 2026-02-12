import { render, screen } from '@testing-library/react'
import { AccessibleFormField } from '../AccessibleFormField'

describe('AccessibleFormField', () => {
  it('should render label correctly', () => {
    render(
      <AccessibleFormField label="Test Label">
        <input type="text" />
      </AccessibleFormField>
    )

    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('should show required indicator when required=true', () => {
    render(
      <AccessibleFormField label="Required Field" required>
        <input type="text" />
      </AccessibleFormField>
    )

    const requiredIndicator = screen.getByLabelText('required')
    expect(requiredIndicator).toBeInTheDocument()
    expect(requiredIndicator).toHaveTextContent('*')
  })

  it('should associate label with input using htmlFor and id', () => {
    render(
      <AccessibleFormField label="Email Address">
        <input type="email" />
      </AccessibleFormField>
    )

    const label = screen.getByText('Email Address')
    const input = screen.getByRole('textbox')
    
    expect(label).toHaveAttribute('for', input.id)
  })

  it('should render description when provided', () => {
    const description = 'Enter your email address'
    
    render(
      <AccessibleFormField label="Email" description={description}>
        <input type="email" />
      </AccessibleFormField>
    )

    expect(screen.getByText(description)).toBeInTheDocument()
  })

  it('should display error message with proper ARIA attributes', () => {
    const errorMessage = 'This field is required'
    
    render(
      <AccessibleFormField label="Email" error={errorMessage}>
        <input type="email" />
      </AccessibleFormField>
    )

    const errorElement = screen.getByRole('alert')
    expect(errorElement).toBeInTheDocument()
    expect(errorElement).toHaveTextContent(errorMessage)
    expect(errorElement).toHaveAttribute('aria-live', 'polite')
  })

  it('should set aria-invalid=true when error exists', () => {
    render(
      <AccessibleFormField label="Email" error="Invalid email">
        <input type="email" />
      </AccessibleFormField>
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('should set aria-required=true when required', () => {
    render(
      <AccessibleFormField label="Email" required>
        <input type="email" />
      </AccessibleFormField>
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('should connect input to description and error with aria-describedby', () => {
    const description = 'Enter a valid email'
    const error = 'Invalid format'

    render(
      <AccessibleFormField label="Email" description={description} error={error}>
        <input type="email" />
      </AccessibleFormField>
    )

    const input = screen.getByRole('textbox')
    const describedBy = input.getAttribute('aria-describedby')
    
    expect(describedBy).toBeTruthy()
    
    // Both description and error IDs should be in aria-describedby
    const descElement = screen.getByText(description)
    const errorElement = screen.getByRole('alert')
    
    expect(describedBy).toContain(descElement.id)
    expect(describedBy).toContain(errorElement.id)
  })

  it('should work with different input types', () => {
    const { rerender } = render(
      <AccessibleFormField label="Password">
        <input type="password" />
      </AccessibleFormField>
    )

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')

    rerender(
      <AccessibleFormField label="Message">
        <textarea />
      </AccessibleFormField>
    )

    expect(screen.getByLabelText('Message')).toHaveProperty('tagName', 'TEXTAREA')
  })
})