# Corporate Customers Database Structure

## Database Collection: `corporateCustomers`

### Document Structure:
```javascript
{
  id: "auto-generated-id",
  corporateName: "Company Name",
  email: "company@email.com",
  phone: "+1234567890",
  address: "Company Address",
  notes: "Additional notes about the company",
  contactPersons: [
    {
      id: "unique-contact-id",
      name: "Contact Person Name",
      email: "contact@email.com",
      phone: "+1234567890",
      position: "Manager/CEO/etc",
      isPrimary: true/false
    }
  ],
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### Features:
- **Corporate Customer Management**: Full CRUD operations for corporate customers
- **Contact Person Management**: Add, edit, delete multiple contact persons per corporate customer
- **Primary Contact**: Mark one contact person as primary
- **Expandable UI**: Contact persons are shown in expandable accordions
- **Responsive Design**: Cards layout that works on all screen sizes
- **Gold Theme**: Consistent with app's design system

### Database Operations:
- **Create**: Add new corporate customer with contact persons
- **Read**: Fetch all corporate customers with their contact persons
- **Update**: Edit corporate customer details and contact persons
- **Delete**: Remove corporate customer and all associated contact persons

### Contact Person Features:
- Multiple contact persons per corporate customer
- Primary contact designation
- Individual contact person management
- Expandable/collapsible contact person lists
- Add/Edit/Delete contact persons independently

