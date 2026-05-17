import { useRoles } from '../context/roles-context'
import { RolesFormDialog } from './roles-form-dialog'
import { RolesDeleteDialog } from './roles-delete-dialog'

export function RolesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useRoles()

  const handleFormOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setOpen(null)
      setTimeout(() => {
        setCurrentRow(null)
      }, 500)
    }
  }

  return (
    <>
      <RolesFormDialog
        key={currentRow ? `role-${currentRow.roleId}` : 'role-add'}
        open={open === 'add' || open === 'edit'}
        onOpenChange={handleFormOpenChange}
        currentRow={currentRow}
      />

      {currentRow && (
        <RolesDeleteDialog
          key={`role-delete-${currentRow.roleId}`}
          open={open === 'delete'}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }
          }}
        />
      )}
    </>
  )
}
