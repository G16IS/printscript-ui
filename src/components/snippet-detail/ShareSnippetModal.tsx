import {Alert, Autocomplete, Box, Button, Divider, TextField, Typography} from "@mui/material";
import {ModalWrapper} from "../common/ModalWrapper.tsx";
import {useGetUsers} from "../../utils/queries.tsx";
import {useEffect, useState} from "react";
import {User} from "../../utils/users.ts";
import {snippetErrorMessage} from "../../utils/snippetError.ts";

type ShareSnippetModalProps = {
  open: boolean
  onClose: () => void
  onShare: (userId: string) => void
  loading: boolean
}
export const ShareSnippetModal = (props: ShareSnippetModalProps) => {
  const {open, onClose, onShare, loading} = props
  const [name, setName] = useState("")
  const [debouncedName, setDebouncedName] = useState("")
  const {data, isLoading, error} = useGetUsers(debouncedName, 0, 10)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    const getData = setTimeout(() => {
      setDebouncedName(name)
    }, 300)
    return () => clearTimeout(getData)
  }, [name])

  useEffect(() => {
    if (!open) {
      setSelectedUser(null)
      setName("")
    }
  }, [open])

  return (
      <ModalWrapper open={open} onClose={onClose}>
        <Typography variant={"h5"}>Share your snippet</Typography>
        <Divider/>
        <Box mt={2}>
          <Autocomplete
              renderInput={(params) => <TextField {...params} label="Search users by name or email"/>}
              options={data?.users ?? []}
              isOptionEqualToValue={(option, value) =>
                  option.id === value.id
              }
              getOptionLabel={(option) => option.name}
              filterOptions={(x) => x}
              renderOption={(optionProps, option) => (
                  <li {...optionProps} key={option.id}>
                    <Box>
                      <Typography>{option.name}</Typography>
                      {option.email && <Typography variant={"body2"} color={"text.secondary"}>{option.email}</Typography>}
                    </Box>
                  </li>
              )}
              loading={isLoading}
              value={selectedUser}
              inputValue={name}
              onInputChange={(_: unknown, newValue: string) => setName(newValue)}
              onChange={(_: unknown, newValue: User | null) => setSelectedUser(newValue)}
          />
          {error && <Alert severity={"error"} sx={{mt: 2}}>Could not load users: {snippetErrorMessage(error)}</Alert>}
          <Box mt={4} display={"flex"} width={"100%"} justifyContent={"flex-end"}>
            <Button onClick={onClose} variant={"outlined"}>Cancel</Button>
            <Button disabled={!selectedUser || loading} onClick={() => selectedUser && onShare(selectedUser?.id)} sx={{marginLeft: 2}} variant={"contained"}>Share</Button>
          </Box>
        </Box>
      </ModalWrapper>
  )
}
