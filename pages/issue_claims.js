import React from "react"
import PageLayout from "../layout/PageLayout"
import Ibox from "../component/Ibox"
import Web3 from "web3"
import { connect } from "react-redux"
import sampleAddresses from "../util/sampleAddresses"
import axios from "axios"
import TableComponents from "../component/Table"
import { typesOfHospitals, typesOfClinics } from "../util/hospitalMetadata"
import { getHospitalInfo, getIssuedClaims } from "../util/contractHelpers"
const { Wrapper, Head, HeadColumn, Body, BodyColumn } = TableComponents

const gas = 1500000
const gasPrice = "20000000000"

const hospitalInfoFields = [
  {
    name: "facilityName",
    label: "병원 이름"
  },
  {
    name: "typeOfHospital",
    label: "병원 종류"
  },
  {
    name: "typeOfClinic",
    label: "진단과"
  },
  {
    name: "facilityAdminAddress",
    label: "병원 관리자 주소"
  }
]

class IssueClaims extends React.Component {
  static async getInitialProps({ ctx }) {
    const resp = await axios.get("http://localhost:9090/contracts_meta")
    const networkInfoResponse = await axios.get(
      "http://localhost:9090/network_information"
    )

    const contractABIs = resp.data || []
    const networkInfo = networkInfoResponse.data

    const providerData = contractABIs.filter(abi => abi.name === "Provider")[0]

    const providerAbi = providerData.abi
    const providerBytecode = providerData.bytecode

    return {
      providerAbi,
      providerBytecode,
      port: networkInfo.port,
      host: networkInfo.host,
      networkId: networkInfo.networkId
    }
  }

  constructor(props) {
    super(props)
    this.state = {
      // providerAddress: sampleAddresses[0],
      facilityName: "",
      typeOfClinic: "",
      typeOfHospital: "",
      facilityAdminAddress: ""
      // accountAddressToLoginAs: sampleAddresses[0]
    }
    const { host } = props
    if (host) {
      this.web3 = new Web3(new Web3.providers.HttpProvider(host))
    }
  }

  componentDidMount = () => {
    const { providerAbi, providerContractHash, providerAddress } = this.props
    if (!providerContractHash || !providerAddress) {
      console.log(providerContractHash, providerAddress)
      window.alert("Provider로 접속하기 위한 정보가 제공되지 않았습니다.")
    }
    this.providerContractRef = new this.web3.eth.Contract(
      providerAbi,
      this.props.providerContractHash,
      { from: this.props.providerAddress }
    )

    return getHospitalInfo(this.providerContractRef).then(hospitalInfo => {
      return this.setState({
        facilityAdminAddress: hospitalInfo.owner,
        typeOfClinic: hospitalInfo.clinicalSpecialty,
        typeOfHospital: hospitalInfo.typeOfHospital,
        facilityName: hospitalInfo.facilityName
      })
    })
  }

  fetchProviderData = () => {}
  connectAsProvider = () => {
    const { providerAbi } = this.props
    // Overwrite providerContractRef
    this.providerContractRef = new this.web3.eth.Contract(
      providerAbi,
      this.state.providerContractHash,
      { from: this.state.accountAddressToLoginAs }
    )

    this.retrieveClaimsIssuesByProvider()
  }

  retrieveClaimsIssuesByProvider = () => {
    getHospitalInfo(this.providerContractRef).then(resp => {
      console.log("From Helper")
      console.log(resp)
    })

    return getIssuedClaims(this.providerContractRef).then(
      resp => {
        const claims = resp.map(claim => {
          const [
            type,
            cost,
            description,
            patientAddr,
            createdAt,
            isValidated
          ] = claim
          return {
            type,
            cost,
            description,
            patientAddr,
            createdAt,
            isValidated
          }
        })
        console.log(claims)
        this.setState({
          issuedClaims: claims
        })
        return Promise.resolve(claims)
      },
      err => console.log(err)
    )
  }

  issueClaimForPatient = () => {
    console.log(`Issuing Claim for Patient Addr: ${this.state.providerAddress}`)
    return this.providerContractRef.methods
      .renderClaimForPatient(this.state.providerAddress, [
        "TYPE OF CLAIM",
        10041004,
        "Hello Description"
      ])
      .send({
        from: this.state.providerAddress,
        gas,
        gasPrice
      })
      .then(
        resp => {
          console.log(
            `Successfully issued claim for Patient with tx hash ${
              resp.transactionHash
            }`
          )
        },
        e => console.log(e)
      )
  }

  connectToProvider = async () => {
    const { host, port, networkId, providerAbi } = this.props
    this.web3 = new Web3(new Web3.providers.HttpProvider(host))
    this.providerContractRef = new this.web3.eth.Contract(providerAbi)
  }

  onValueChange = (field, value) => {
    this.setState({
      ...this.state,
      [field]: value
    })
  }

  render() {
    return (
      <PageLayout>
        <div className="row">
          <div className="col-lg-12">
            <Ibox title="Issuing Medical Claims For Patients">
              <div>
                <h4>
                  본 페이지에서는 진료한 환자에 대한 의료 명세서를 발행할 수
                  있습니다.
                </h4>
                <h4>
                  발행한 명세서는 블록체인 상에 저장되며, 환자의 동의 하에
                  데이터 분석를 위해 제 3자에게 활용될 수 있습니다.
                </h4>
              </div>
            </Ibox>
          </div>
        </div>

        <div className="row">
          <div className="col-lg-12">
            <Ibox>
              <div className="row">
                <div className="col-lg-12">
                  <div className="m-b-md">
                    <h2>의료서비스 제공자 정보</h2>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-lg-7">
                  {hospitalInfoFields.map(field => {
                    return (
                      <div className="row mb-0">
                        <div className="col-sm-4">
                          <dt>{field.label}</dt>
                        </div>
                        <div className="col-sm-8">
                          <dd className="mb-1">{this.state[field.name]}</dd>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="col-lg-5">
                  <div>
                    <div className="m-b-1 m-t">
                      <span>누적 처방건수</span>
                      <small className="float-right">32 건</small>
                    </div>
                    <div class="progress progress-small">
                      <div style={{ width: "60%" }} class="progress-bar" />
                    </div>

                    <div className="m-b-1 m-t">
                      <span>누적 환자수</span>
                      <small className="float-right">15</small>
                    </div>
                    <div className="progress progress-small">
                      <div style={{ width: "50%" }} className="progress-bar" />
                    </div>

                    <div className="m-b-1 m-t">
                      <span>누적 처방금액</span>
                      <small className="float-right">4200000</small>
                    </div>
                    <div className="progress progress-small">
                      <div style={{ width: "40%" }} className="progress-bar" />
                    </div>
                  </div>
                </div>
              </div>
            </Ibox>
          </div>
        </div>

        <div className="row">
          <div className="col-lg-12">
            <Ibox title="Patients List">
              <Wrapper>
                <Head>
                  <HeadColumn>#</HeadColumn>
                  <HeadColumn>Name</HeadColumn>
                  <HeadColumn>Year of Birth</HeadColumn>
                  <HeadColumn>Gender</HeadColumn>
                </Head>
                <Body>
                  <BodyColumn>1</BodyColumn>
                  <BodyColumn>Paul</BodyColumn>
                  <BodyColumn>1986</BodyColumn>
                  <BodyColumn>Male</BodyColumn>
                </Body>
              </Wrapper>
            </Ibox>
          </div>
        </div>
      </PageLayout>
    )
  }
}

export default connect(state => ({
  providerAddress: state.providerContract.address,
  providerContractHash: state.providerContract.contractHash,
  patientContractHash: state.patientContract.contrachHash
}))(IssueClaims)