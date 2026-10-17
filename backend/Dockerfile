FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the package layer is reused until a project file changes.
COPY src/HsmLis.Domain/HsmLis.Domain.csproj src/HsmLis.Domain/
COPY src/HsmLis.Application/HsmLis.Application.csproj src/HsmLis.Application/
COPY src/HsmLis.Infrastructure/HsmLis.Infrastructure.csproj src/HsmLis.Infrastructure/
COPY src/HsmLis.Api/HsmLis.Api.csproj src/HsmLis.Api/
RUN dotnet restore src/HsmLis.Api/HsmLis.Api.csproj

COPY src/ src/
RUN dotnet publish src/HsmLis.Api/HsmLis.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
# Npgsql probes for GSSAPI when it connects and logs a load error without libgssapi-krb5-2.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "HsmLis.Api.dll"]
