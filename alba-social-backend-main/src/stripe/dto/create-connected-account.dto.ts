export class CreateConnectedAccountDto {
  email: string;
  individual: {
    email: string;
    phone: string;
    address: {
      city: string;
      line1: string;
      line2: string;
      postal_code: string;
    };
    dob: {
      day: number;
      month: number;
      year: number;
    };
    first_name: string;
    last_name: string;
  };
}
