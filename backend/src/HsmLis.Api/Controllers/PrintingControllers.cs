using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HsmLis.Api.Controllers;

/// <summary>
/// Certificate and signatures for QZ Tray, which prints specimen labels straight to the label printer.
/// Only staff who can open orders (and so print their labels) get a signature.
/// </summary>
[ApiController]
[Route("api/qz")]
[Authorize(Policy = Permissions.Orders)]
public class QzController(IQzSigner signer) : ControllerBase
{
    [HttpGet("certificate")]
    public QzCertificateDto Certificate() => new(signer.Certificate());

    [HttpPost("sign")]
    public QzSignatureDto Sign(QzSignRequest request) => new(signer.Sign(request.Data));
}
