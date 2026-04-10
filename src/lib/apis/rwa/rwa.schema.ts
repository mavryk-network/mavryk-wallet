import * as yup from 'yup';

export const dodoAssetsContractsSchema = yup.object({
  dodo_mav: yup
    .array()
    .of(
      yup
        .object({
          base_token: yup
            .object({
              address: yup.string().required(),
              token_id: yup.number().integer().required()
            })
            .required()
        })
        .required()
    )
    .required()
});
