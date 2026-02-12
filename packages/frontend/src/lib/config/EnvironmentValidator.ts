import { z } from 'zod';

const environmentSchema = z.object({
  SIGNER_PRIVATE_KEY: z.string()
    .startsWith('0x')
    .length(66, 'Private key must be 64 hex characters with 0x prefix'),

  NEXT_PUBLIC_CONTRACT_ADDRESS: z.string()
    .startsWith('0x')
    .length(42, 'Contract address must be valid Ethereum address'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Environment = z.infer<typeof environmentSchema>;

export class EnvironmentValidator {
  private static instance: Environment | null = null;

  static validate(): Environment {
    if (this.instance) {
      return this.instance;
    }

    try {
      this.instance = environmentSchema.parse(process.env);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Environment validation successful');
      }
      return this.instance;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');
        
        console.error('Environment validation failed:\n', errorMessages);
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Environment validation failed. Check server logs for details.');
        }
        process.exit(1);
      }
      
      console.error('Unexpected error during environment validation:', error);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Environment configuration error occurred.');
      }
      process.exit(1);
    }
  }


  static get config(): Environment {
    if (!this.instance) {
      throw new Error('Environment not validated. Call EnvironmentValidator.validate() first.');
    }
    return this.instance;
  }
}